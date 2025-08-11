# 서비스 인스턴스 관리
_file_service_instance = None
_category_service_instance = None

def get_file_service():
    """FileService 싱글톤 인스턴스 반환"""
    global _file_service_instance
    if _file_service_instance is None:
        from .file_service import FileService
        _file_service_instance = FileService()
    return _file_service_instance

def get_category_service():
    """CategoryService 싱글톤 인스턴스 반환"""
    global _category_service_instance
    if _category_service_instance is None:
        from .category_service import CategoryService
        _category_service_instance = CategoryService()
    return _category_service_instance 