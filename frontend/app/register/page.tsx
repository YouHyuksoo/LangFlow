'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { userAPI, personaAPI, categoryAPI } from '@/lib/api'
import Link from 'next/link'
import { AlertCircle, CheckCircle, LucideIcon } from 'lucide-react'
import * as Icons from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useEffect } from 'react'

interface Persona {
  persona_id: string
  name: string
  description: string
}

interface Category {
  category_id: string
  name: string
  description: string
  icon?: string
  color?: string
}

// 아이콘 이름을 실제 아이콘 컴포넌트로 변환하는 함수
const getIconComponent = (iconName?: string): LucideIcon | null => {
  if (!iconName || typeof iconName !== 'string') return null
  
  try {
    // 아이콘 이름을 PascalCase로 변환 (예: folder -> Folder, file-text -> FileText)
    const formatIconName = (name: string) => {
      return name
        .split('-')
        .map(part => part.charAt(0).toUpperCase() + part.slice(1))
        .join('')
    }

    const formattedName = formatIconName(iconName)
    return (Icons as any)[formattedName] || null
  } catch (error) {
    console.warn('아이콘 변환 실패:', iconName, error)
    return null
  }
}

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    full_name: '',
    persona: 'general',
    interest_areas: [] as string[]
  })
  const [personas, setPersonas] = useState<Persona[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null)
  const router = useRouter()

  useEffect(() => {
    // 페르소나와 카테고리 목록 로드
    const loadData = async () => {
      try {
        const [personaData, categoryData] = await Promise.all([
          personaAPI.getPersonas(),
          categoryAPI.getCategories()
        ])
        console.log('페르소나 데이터:', personaData)
        console.log('페르소나 데이터 타입:', typeof personaData)
        console.log('페르소나가 배열인가?', Array.isArray(personaData))
        console.log('카테고리 데이터:', categoryData)
        console.log('카테고리 데이터 타입:', typeof categoryData)
        console.log('카테고리가 배열인가?', Array.isArray(categoryData))
        
        // 데이터가 배열인지 확인하고 안전하게 설정
        if (Array.isArray(personaData)) {
          setPersonas(personaData.map(p => ({
            ...p,
            persona_id: String(p.persona_id || ''),
            name: String(p.name || '')
          })))
        } else {
          console.warn('페르소나 데이터가 배열이 아닙니다:', personaData)
          setPersonas([])
        }
        
        if (Array.isArray(categoryData)) {
          setCategories(categoryData.map(c => ({
            ...c,
            category_id: String(c.category_id || ''),
            name: String(c.name || '')
          })))
        } else {
          console.warn('카테고리 데이터가 배열이 아닙니다:', categoryData)
          setCategories([])
        }
      } catch (error) {
        console.error('데이터 로드 실패:', error)
        setPersonas([])
        setCategories([])
        setMessage({type: 'error', text: '페이지 데이터를 불러오는데 실패했습니다.'})
      }
    }
    loadData()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage(null)

    // 클라이언트 측 유효성 검증
    if (formData.username.trim().length < 3) {
      setMessage({type: 'error', text: '사용자명은 3글자 이상이어야 합니다.'})
      setLoading(false)
      return
    }
    
    if (formData.username.trim().length > 50) {
      setMessage({type: 'error', text: '사용자명은 50글자 이하여야 합니다.'})
      setLoading(false)
      return
    }
    
    if (formData.password.length < 6) {
      setMessage({type: 'error', text: '비밀번호는 6글자 이상이어야 합니다.'})
      setLoading(false)
      return
    }
    
    if (!formData.email.trim() || !formData.email.includes('@')) {
      setMessage({type: 'error', text: '유효한 이메일 주소를 입력하세요.'})
      setLoading(false)
      return
    }

    // 비밀번호 확인
    if (formData.password !== formData.confirmPassword) {
      setMessage({type: 'error', text: '비밀번호가 일치하지 않습니다.'})
      setLoading(false)
      return
    }

    try {
      // 데이터 검증 및 정리
      const registrationData = {
        username: formData.username.trim(),
        email: formData.email.trim(),
        password: formData.password,
        full_name: formData.full_name?.trim() || '',
        persona: formData.persona || 'general',
        interest_areas: formData.interest_areas || []
      }
      
      console.log('Registration data to send:', registrationData)
      
      const response = await userAPI.register(registrationData)

      console.log('Registration response:', response)

      if (response && response.success) {
        setMessage({type: 'success', text: response.message || '회원가입 신청이 완료되었습니다.'})
        // 3초 후 로그인 페이지로 이동
        setTimeout(() => {
          router.push('/login')
        }, 3000)
      } else {
        setMessage({type: 'error', text: response?.message || '회원가입 신청 처리에 실패했습니다.'})
      }
    } catch (error: any) {
      console.error('Registration error:', error)
      console.error('Error details:', {
        message: error.message,
        response: error.response,
        data: error.response?.data,
        status: error.response?.status
      })
      
      let errorMessage = '회원가입 중 오류가 발생했습니다.'
      
      try {
        if (error.response?.data) {
          console.log('Error response data type:', typeof error.response.data)
          console.log('Error response data:', error.response.data)
          
          // FastAPI validation error handling
          if (Array.isArray(error.response.data)) {
            // Pydantic validation errors come as an array
            if (error.response.data.length > 0 && error.response.data[0].msg) {
              const firstError = error.response.data[0]
              errorMessage = `${firstError.msg}${firstError.loc ? ' (' + firstError.loc.join('.') + ')' : ''}`
            }
          } else if (error.response.data.detail) {
            errorMessage = String(error.response.data.detail)
          } else if (error.response.data.message) {
            errorMessage = String(error.response.data.message)
          } else if (typeof error.response.data === 'string') {
            errorMessage = error.response.data
          } else if (typeof error.response.data === 'object') {
            // Handle any complex object by converting to string safely
            errorMessage = '서버에서 유효성 검증 오류가 발생했습니다.'
          }
        } else if (error.message) {
          errorMessage = String(error.message)
        }
      } catch (parseError) {
        console.error('Error parsing error response:', parseError)
        errorMessage = '회원가입 처리 중 알 수 없는 오류가 발생했습니다.'
      }
      
      setMessage({type: 'error', text: errorMessage})
    } finally {
      setLoading(false)
    }
  }

  // 카테고리를 관심 분야로 사용

  const handleInterestChange = (categoryId: string, checked: boolean) => {
    if (checked) {
      setFormData(prev => ({
        ...prev,
        interest_areas: [...prev.interest_areas, categoryId]
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        interest_areas: prev.interest_areas.filter(area => area !== categoryId)
      }))
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-center">회원가입</CardTitle>
        </CardHeader>
        <CardContent>
          {message && (
            <Alert className={`mb-4 ${message.type === 'success' ? 'border-primary' : 'border-destructive'}`}>
              {message.type === 'success' ? (
                <CheckCircle className="h-4 w-4 text-primary" />
              ) : (
                <AlertCircle className="h-4 w-4 text-destructive" />
              )}
              <AlertDescription className={message.type === 'success' ? 'text-primary' : 'text-destructive'}>
                {typeof message.text === 'string' ? message.text : '오류가 발생했습니다.'}
              </AlertDescription>
            </Alert>
          )}
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="username">사용자명 *</Label>
              <Input
                id="username"
                type="text"
                value={formData.username}
                onChange={(e) => setFormData(prev => ({...prev, username: e.target.value}))}
                required
                placeholder="사용자명을 입력하세요"
              />
            </div>

            <div>
              <Label htmlFor="email">이메일 *</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({...prev, email: e.target.value}))}
                required
                placeholder="이메일을 입력하세요"
              />
            </div>

            <div>
              <Label htmlFor="full_name">실명</Label>
              <Input
                id="full_name"
                type="text"
                value={formData.full_name}
                onChange={(e) => setFormData(prev => ({...prev, full_name: e.target.value}))}
                placeholder="실명을 입력하세요 (선택사항)"
              />
            </div>

            <div>
              <Label htmlFor="password">비밀번호 *</Label>
              <Input
                id="password"
                type="password"
                value={formData.password}
                onChange={(e) => setFormData(prev => ({...prev, password: e.target.value}))}
                required
                placeholder="비밀번호를 입력하세요"
              />
            </div>

            <div>
              <Label htmlFor="confirmPassword">비밀번호 확인 *</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={(e) => setFormData(prev => ({...prev, confirmPassword: e.target.value}))}
                required
                placeholder="비밀번호를 다시 입력하세요"
              />
            </div>

            <div>
              <Label htmlFor="persona">페르소나</Label>
              <Select value={formData.persona} onValueChange={(value) => setFormData(prev => ({...prev, persona: value}))}>
                <SelectTrigger>
                  <SelectValue placeholder="페르소나를 선택하세요" />
                </SelectTrigger>
                <SelectContent>
                  {personas && personas.length > 0 ? personas.map((persona) => (
                    <SelectItem 
                      key={String(persona.persona_id || persona.name)} 
                      value={String(persona.persona_id)}
                    >
                      {String(persona.name || '이름 없음')}
                    </SelectItem>
                  )) : (
                    <SelectItem value="general">일반</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>관심 분야 (선택사항)</Label>
              <p className="text-sm text-muted-foreground mb-3">클릭하여 관심 있는 카테고리를 선택하세요.</p>
              <div className="flex flex-wrap gap-2">
                {categories && categories.length > 0 ? categories.map((category) => {
                  const categoryId = String(category.category_id || '')
                  const categoryName = String(category.name || '이름 없음')
                  const IconComponent = getIconComponent(category.icon)
                  
                  return (
                    <Badge
                      key={categoryId || categoryName}
                      variant={formData.interest_areas.includes(categoryId) ? "default" : "outline"}
                      className="cursor-pointer transition-colors" 
                      onClick={() => handleInterestChange(categoryId, !formData.interest_areas.includes(categoryId))}
                    >
                      {IconComponent && <IconComponent className="w-3 h-3 mr-1" />}
                      {categoryName}
                    </Badge>
                  )
                }) : (
                  <p className="text-sm text-muted-foreground">카테고리를 불러오는 중...</p>
                )}
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? '신청 중...' : '회원가입 신청'}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm">
            이미 계정이 있으신가요?{' '}
            <Link href="/login" className="text-primary hover:underline">
              로그인
            </Link>
          </div>
          
          <div className="mt-4 p-3 bg-accent rounded-md">
            <p className="text-xs text-accent-foreground">
              ⚠️ 회원가입 신청 후 관리자 승인을 받아야 서비스를 이용할 수 있습니다.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}