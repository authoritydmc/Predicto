"""
Base score calculator interface
Abstract base class for sport-specific calculators
"""

from abc import ABC, abstractmethod
from typing import Dict, Any, Tuple


class ScoreCalculator(ABC):
    """Abstract base class for sport-specific score calculators"""
    
    @abstractmethod
    def calculate_innings1_points(self, prediction: Dict[str, Any], actual_score: int, meta: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate points for 1st innings prediction
        
        Args:
            prediction: User prediction data
            actual_score: Actual 1st innings score
            meta: Match metadata (team names, disableScore flags, etc.)
            
        Returns:
            Dict with points, diff, isExact, etc.
        """
        pass
    
    @abstractmethod
    def calculate_innings2_points(self, prediction: Dict[str, Any], actual_winner: str, 
                                  actual_result: str, meta: Dict[str, Any], is_overs: bool) -> Dict[str, Any]:
        """
        Calculate points for 2nd innings prediction
        
        Args:
            prediction: User prediction data
            actual_winner: Actual match winner
            actual_result: Actual chasing score or overs
            meta: Match metadata
            is_overs: Whether result is in overs format
            
        Returns:
            Dict with points, diff, isExact, etc.
        """
        pass
    
    @abstractmethod
    def calculate_penalty(self, prediction1: Dict[str, Any], prediction2: Dict[str, Any]) -> int:
        """
        Calculate penalty for inconsistent winner predictions
        
        Args:
            prediction1: 1st innings prediction
            prediction2: 2nd innings prediction
            
        Returns:
            Penalty score (negative for deduction)
        """
        pass
    
    @abstractmethod
    def get_sport_name(self) -> str:
        """Return the sport name for this calculator"""
        pass
