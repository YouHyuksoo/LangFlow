
class FallbackException(Exception):
    """A processor failed and the next one in the chain should be tried."""
    pass
