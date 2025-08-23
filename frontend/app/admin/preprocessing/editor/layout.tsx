'use client'

export default function EditorLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="h-screen w-full bg-background overflow-hidden">
      {children}
    </div>
  )
}