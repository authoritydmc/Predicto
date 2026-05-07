"""Task registry for automation scripts"""
import logging
from typing import Dict, Callable, Any, Optional, List

logger = logging.getLogger(__name__)

class TaskRegistry:
    """Registry for automation tasks"""
    
    def __init__(self):
        self._tasks: Dict[str, Callable] = {}
    
    def register(self, name: str, func: Callable):
        """Register a task function"""
        self._tasks[name] = func
        logger.info(f"Registered task: {name}")
    
    def get_task(self, name: str) -> Optional[Callable]:
        """Get a task function by name"""
        return self._tasks.get(name)
    
    def list_tasks(self) -> List[str]:
        """List all registered tasks"""
        return list(self._tasks.keys())
    
    def execute(self, name: str, *args, **kwargs) -> Any:
        """Execute a task by name"""
        task = self.get_task(name)
        if not task:
            raise ValueError(f"Task not found: {name}")
        return task(*args, **kwargs)


# Global task registry
registry = TaskRegistry()


def register_task(name: str):
    """Decorator to register a task"""
    def decorator(func):
        registry.register(name, func)
        return func
    return decorator
