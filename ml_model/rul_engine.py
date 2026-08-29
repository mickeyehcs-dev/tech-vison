"""RUL interface for the frozen Phase 9.1 predictor.

RUL is a dataset-derived estimate, not a supervised time-to-failure target.
"""
from predict import estimate_rul

__all__ = ["estimate_rul"]
