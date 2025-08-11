import os
import logging
from logging import Logger
from logging.handlers import RotatingFileHandler
from datetime import datetime
from typing import Tuple

from .config import settings


class JsonFormatter(logging.Formatter):
    """간단한 JSON 라인 포맷터 (의존성 추가 없이 구현)."""

    def format(self, record: logging.LogRecord) -> str:
        # record.__dict__의 직렬화가 어려운 항목들은 문자열로 강제 변환
        payload = {
            "timestamp": datetime.utcfromtimestamp(record.created).isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # event, module, func, line, extras
        payload["module"] = getattr(record, "module", None)
        payload["funcName"] = getattr(record, "funcName", None)
        payload["lineno"] = getattr(record, "lineno", None)

        # extra 에 담긴 필드를 병합 (표준 키와 충돌 피함)
        for key, value in record.__dict__.items():
            if key in (
                "name",
                "msg",
                "args",
                "levelname",
                "levelno",
                "pathname",
                "filename",
                "module",
                "exc_info",
                "exc_text",
                "stack_info",
                "lineno",
                "funcName",
                "created",
                "msecs",
                "relativeCreated",
                "thread",
                "threadName",
                "processName",
                "process",
            ):
                continue
            # 사용자가 넘긴 의미있는 키만 추가
            if key in ("event", "category", "flow_id", "file_id", "user_id"):
                payload[key] = value

        # 안전한 문자열화
        try:
            import json
            return json.dumps(payload, ensure_ascii=False)
        except Exception:
            return f"{payload}"


def _ensure_log_paths() -> Tuple[str, str]:
    base_logs_dir = os.path.join(settings.DATA_DIR, "logs")
    console_root = os.path.join(base_logs_dir, "console")
    user_root = os.path.join(base_logs_dir, "user")

    today = datetime.now().strftime("%Y-%m-%d")
    console_dir = os.path.join(console_root, today)
    user_dir = os.path.join(user_root, today)

    os.makedirs(console_dir, exist_ok=True)
    os.makedirs(user_dir, exist_ok=True)

    console_file = os.path.join(console_dir, "console.log")
    user_file = os.path.join(user_dir, "user.log")
    return console_file, user_file


class DailyRotatingFileHandler(RotatingFileHandler):
    """날짜가 바뀌면 자동으로 날짜별 디렉토리로 로그 파일을 변경하는 핸들러."""

    def __init__(self, is_user: bool, *args, **kwargs):
        # dummy filename; 실제는 emit에서 동적으로 설정
        kwargs.setdefault("delay", True)
        super().__init__(filename="", *args, **kwargs)
        self.is_user = is_user
        self._current_date = None
        self._roll_to_today(force=True)

    def _roll_to_today(self, force: bool = False):
        today = datetime.now().strftime("%Y-%m-%d")
        if force or today != self._current_date:
            self._current_date = today
            console_file, user_file = _ensure_log_paths()
            new_filename = user_file if self.is_user else console_file
            # 파일 변경
            if self.stream:
                self.stream.close()
                self.stream = None
            self.baseFilename = os.fspath(new_filename)
            self.stream = self._open()

    def emit(self, record: logging.LogRecord) -> None:
        # 기록 시점에 날짜 변경 여부 확인
        self._roll_to_today()
        super().emit(record)


def setup_logging() -> None:
    """통합 로깅 설정: 콘솔/사용자 로그를 날짜별 디렉토리에 저장하고 콘솔 출력도 동시에 수행."""
    console_file, user_file = _ensure_log_paths()

    # 포맷터
    console_formatter = logging.Formatter(
        "%(asctime)s | %(levelname)s | %(name)s | %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S",
    )
    json_formatter = JsonFormatter()

    # 콘솔 스트림 핸들러 (터미널 출력)
    stream_handler = logging.StreamHandler()
    stream_handler.setFormatter(console_formatter)
    # 콘솔은 기본적으로 INFO 이상만 출력하여 과도한 디버그 노이즈를 억제
    stream_handler.setLevel(logging.INFO)

    # 파일 핸들러 (회전: 10MB, 5개 보관) - 날짜별 폴더 아래 파일 경로 사용
    console_file_handler = DailyRotatingFileHandler(
        is_user=False, maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8"
    )
    console_file_handler.setFormatter(json_formatter)
    console_file_handler.setLevel(logging.DEBUG)

    user_file_handler = DailyRotatingFileHandler(
        is_user=True, maxBytes=10 * 1024 * 1024, backupCount=5, encoding="utf-8"
    )
    user_file_handler.setFormatter(json_formatter)
    user_file_handler.setLevel(logging.INFO)

    # 루트 로거 기본 설정 (중복 출력 방지 위해 최소 설정)
    root = logging.getLogger()
    root.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)
    # 루트에는 핸들러 추가하지 않음 (개별 로거에 설정)

    # 콘솔 로거
    console_logger = logging.getLogger("console")
    console_logger.handlers.clear()
    console_logger.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)
    console_logger.propagate = False
    console_logger.addHandler(stream_handler)
    console_logger.addHandler(console_file_handler)

    # 사용자 이벤트 로거
    user_logger = logging.getLogger("user")
    user_logger.handlers.clear()
    user_logger.setLevel(logging.INFO)
    user_logger.propagate = False
    user_logger.addHandler(stream_handler)
    user_logger.addHandler(user_file_handler)


def get_console_logger() -> Logger:
    return logging.getLogger("console")


def get_user_logger() -> Logger:
    return logging.getLogger("user")


