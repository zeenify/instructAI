"""
Metrics logging for Groq API requests - tracks tokens, requests, and performance
"""
import json
from datetime import datetime
from typing import Optional

# ANSI Colors for terminal output
class Colors:
    RESET = '\033[0m'
    BOLD = '\033[1m'
    DIM = '\033[2m'

    # Foreground colors
    BLACK = '\033[30m'
    RED = '\033[31m'
    GREEN = '\033[32m'
    YELLOW = '\033[33m'
    BLUE = '\033[34m'
    MAGENTA = '\033[35m'
    CYAN = '\033[36m'
    WHITE = '\033[37m'

    # Background colors
    BG_RED = '\033[41m'
    BG_GREEN = '\033[42m'
    BG_YELLOW = '\033[43m'
    BG_BLUE = '\033[44m'


# Global metrics tracking
class MetricsTracker:
    def __init__(self):
        self.requests = []
        self.total_prompt_tokens = 0
        self.total_completion_tokens = 0
        self.total_requests = 0
        self.failed_requests = 0
        self.rate_limited_requests = 0

    def log_request(self, endpoint: str, model: str, prompt_tokens: int,
                   completion_tokens: int = 0, success: bool = True,
                   rate_limited: bool = False, duration_ms: float = 0):
        """Log API request metrics"""
        self.total_requests += 1
        if not success:
            self.failed_requests += 1
        if rate_limited:
            self.rate_limited_requests += 1

        self.total_prompt_tokens += prompt_tokens
        self.total_completion_tokens += completion_tokens

        self.requests.append({
            'endpoint': endpoint,
            'model': model,
            'prompt_tokens': prompt_tokens,
            'completion_tokens': completion_tokens,
            'total_tokens': prompt_tokens + completion_tokens,
            'success': success,
            'rate_limited': rate_limited,
            'duration_ms': duration_ms,
            'timestamp': datetime.now().isoformat()
        })

    def print_summary(self):
        """Print overall metrics summary"""
        print("\n" + "╔" + "═" * 78 + "╗")
        print("║" + f" {Colors.BOLD}{Colors.GREEN}✓ OVERALL API METRICS SUMMARY{Colors.RESET}".ljust(78) + "║")
        print("╠" + "═" * 78 + "╣")

        total_success = self.total_requests - self.failed_requests
        print("║ " + f"{Colors.BOLD}Request Summary:{Colors.RESET}".ljust(77) + "║")
        print("║   " + f"Total Requests:        {Colors.CYAN}{self.total_requests}{Colors.RESET}".ljust(75) + "║")
        print("║   " + f"Successful:            {Colors.GREEN}{total_success}{Colors.RESET}".ljust(75) + "║")
        print("║   " + f"Failed:                {Colors.RED}{self.failed_requests}{Colors.RESET}".ljust(75) + "║")
        print("║   " + f"Rate Limited:          {Colors.YELLOW}{self.rate_limited_requests}{Colors.RESET}".ljust(75) + "║")

        print("║ " + f"\n{Colors.BOLD}Token Usage:{Colors.RESET}".ljust(77) + "║")
        total_tokens = self.total_prompt_tokens + self.total_completion_tokens
        print("║   " + f"Prompt Tokens:         {Colors.BLUE}{self.total_prompt_tokens:,}{Colors.RESET}".ljust(75) + "║")
        print("║   " + f"Completion Tokens:     {Colors.MAGENTA}{self.total_completion_tokens:,}{Colors.RESET}".ljust(75) + "║")
        print("║   " + f"Total Tokens:          {Colors.BOLD}{total_tokens:,}{Colors.RESET}".ljust(75) + "║")

        if self.requests:
            avg_duration = sum(r['duration_ms'] for r in self.requests) / len(self.requests)
            total_duration = sum(r['duration_ms'] for r in self.requests)
            print("║ " + f"\n{Colors.BOLD}Performance:{Colors.RESET}".ljust(77) + "║")
            print("║   " + f"Average Duration:      {Colors.CYAN}{avg_duration:.2f}ms{Colors.RESET}".ljust(75) + "║")
            print("║   " + f"Total Duration:        {Colors.CYAN}{total_duration:.2f}ms{Colors.RESET}".ljust(75) + "║")

        print("╚" + "═" * 78 + "╝\n")

    def print_summary_by_model(self):
        """Print summary grouped by model"""
        if not self.requests:
            return

        by_model = {}
        for req in self.requests:
            model = req['model']
            if model not in by_model:
                by_model[model] = {
                    'count': 0,
                    'prompt_tokens': 0,
                    'completion_tokens': 0,
                    'duration_ms': 0,
                    'errors': 0
                }
            by_model[model]['count'] += 1
            by_model[model]['prompt_tokens'] += req['prompt_tokens']
            by_model[model]['completion_tokens'] += req['completion_tokens']
            by_model[model]['duration_ms'] += req['duration_ms']
            if not req['success']:
                by_model[model]['errors'] += 1

        print("\n" + "╔" + "═" * 78 + "╗")
        print("║" + f" {Colors.BOLD}{Colors.CYAN}📊 SUMMARY BY MODEL{Colors.RESET}".ljust(78) + "║")
        print("╠" + "═" * 78 + "╣")

        for model, stats in by_model.items():
            total_tokens = stats['prompt_tokens'] + stats['completion_tokens']
            avg_duration = stats['duration_ms'] / stats['count'] if stats['count'] > 0 else 0

            model_display = model.split('-')[0] if '-' in model else model
            print("║ " + f"{Colors.BOLD}{model_display}{Colors.RESET}".ljust(77) + "║")
            print("║   " + f"Requests:              {Colors.CYAN}{stats['count']}{Colors.RESET} (Errors: {Colors.RED}{stats['errors']}{Colors.RESET})".ljust(75) + "║")
            print("║   " + f"Tokens:                {Colors.MAGENTA}{total_tokens:,}{Colors.RESET} (📥 {Colors.BLUE}{stats['prompt_tokens']:,}{Colors.RESET}, 📤 {Colors.MAGENTA}{stats['completion_tokens']:,}{Colors.RESET})".ljust(75) + "║")
            print("║   " + f"Avg Duration:          {Colors.CYAN}{avg_duration:.2f}ms{Colors.RESET}".ljust(75) + "║")
            print("║")

        print("╚" + "═" * 78 + "╝\n")


# Global tracker instance
_tracker = MetricsTracker()


def _get_stage_label(endpoint: str) -> str:
    """Extract stage label from endpoint name"""
    if 'curriculum' in endpoint.lower():
        return "📋 CURRICULUM"
    elif 'stage1' in endpoint.lower() or 'outline' in endpoint.lower():
        return "1️⃣  STAGE 1 (Outline)"
    elif 'stage2' in endpoint.lower() or 'content' in endpoint.lower():
        return "2️⃣  STAGE 2 (Content)"
    elif 'stage3' in endpoint.lower() or 'format' in endpoint.lower():
        return "3️⃣  STAGE 3 (Format)"
    elif 'quiz' in endpoint.lower():
        return "❓ QUIZ"
    return "🔧 API"


def _get_model_color(model: str) -> str:
    """Get color based on model"""
    if '70b' in model:
        return Colors.RED  # Heavy lifting
    elif '8b' in model:
        return Colors.GREEN  # Lightweight
    return Colors.WHITE


def log_api_request(endpoint: str, messages: list, model: str,
                   duration_ms: float = 0, success: bool = True,
                   rate_limited: bool = False, **kwargs):
    """
    Log API request with metrics

    Args:
        endpoint: API endpoint name
        messages: List of chat messages
        model: Model name
        duration_ms: Request duration in milliseconds
        success: Whether request succeeded
        rate_limited: Whether request hit rate limit
        **kwargs: Additional parameters (ignored for cleaner logs)
    """
    # Calculate tokens (rough estimate: ~4 chars per token)
    prompt_tokens = sum(len(msg.get("content", "")) // 4 for msg in messages)

    stage = _get_stage_label(endpoint)
    model_color = _get_model_color(model)
    model_short = model.split('-')[-2] if '-' in model else model

    # Build status indicator
    status = f"{Colors.GREEN}→ REQUEST{Colors.RESET}"

    print(f"\n{Colors.DIM}┌─ {Colors.RESET}{stage} {Colors.DIM}{'─' * 45}{Colors.RESET}")
    print(f"{Colors.DIM}│{Colors.RESET} {status}")
    print(f"{Colors.DIM}│{Colors.RESET} Endpoint:  {Colors.CYAN}{endpoint}{Colors.RESET}")
    print(f"{Colors.DIM}│{Colors.RESET} Model:     {model_color}{model_short}{Colors.RESET}")
    print(f"{Colors.DIM}│{Colors.RESET} Prompt:    {Colors.BLUE}~{prompt_tokens} tokens{Colors.RESET}")

    if rate_limited:
        print(f"{Colors.DIM}│{Colors.RESET} Status:    {Colors.YELLOW}⚠ RATE LIMITED{Colors.RESET}")
    if not success:
        print(f"{Colors.DIM}│{Colors.RESET} Status:    {Colors.RED}✗ FAILED{Colors.RESET}")

    _tracker.log_request(endpoint, model, prompt_tokens, success=success,
                        rate_limited=rate_limited, duration_ms=duration_ms)


def log_api_response(endpoint: str, response_content: str,
                    completion_tokens: int = 0, duration_ms: float = 0,
                    streaming: bool = False):
    """
    Log API response with token metrics

    Args:
        endpoint: API endpoint name
        response_content: Raw response content
        completion_tokens: Actual completion tokens from API response
        duration_ms: Request duration
        streaming: Whether this is a streaming response
    """
    # Estimate if not provided
    if completion_tokens == 0:
        completion_tokens = len(response_content) // 4

    stage = _get_stage_label(endpoint)
    total_tokens = (sum(len(msg.get("content", "")) // 4 for msg in []) if False else 0) + completion_tokens

    status = f"{Colors.GREEN}✓ RESPONSE{Colors.RESET}"

    print(f"{Colors.DIM}│{Colors.RESET} {status}")
    print(f"{Colors.DIM}│{Colors.RESET} Completion: {Colors.MAGENTA}~{completion_tokens} tokens{Colors.RESET}")
    print(f"{Colors.DIM}│{Colors.RESET} Duration:   {Colors.CYAN}{duration_ms:.2f}ms{Colors.RESET}")

    if streaming:
        print(f"{Colors.DIM}│{Colors.RESET} Mode:       {Colors.YELLOW}🔄 STREAMING{Colors.RESET}")

    print(f"{Colors.DIM}└─ {Colors.RESET}")


def log_error(endpoint: str, error: Exception, duration_ms: float = 0):
    """
    Log API error

    Args:
        endpoint: API endpoint name
        error: Exception object
        duration_ms: How long it took before failing
    """
    error_type = type(error).__name__
    is_rate_limit = "rate_limit" in str(error).lower()
    error_msg = str(error)[:100]  # Truncate long error messages

    stage = _get_stage_label(endpoint)
    status = f"{Colors.RED}✗ ERROR{Colors.RESET}"

    print(f"\n{Colors.DIM}┌─ {Colors.RESET}{stage} {Colors.DIM}{'─' * 45}{Colors.RESET}")
    print(f"{Colors.DIM}│{Colors.RESET} {status}")
    print(f"{Colors.DIM}│{Colors.RESET} Endpoint:   {Colors.CYAN}{endpoint}{Colors.RESET}")
    print(f"{Colors.DIM}│{Colors.RESET} Error Type: {Colors.RED}{error_type}{Colors.RESET}")

    if is_rate_limit:
        print(f"{Colors.DIM}│{Colors.RESET} Issue:      {Colors.YELLOW}⚠ RATE LIMITED{Colors.RESET}")

    if error_msg:
        print(f"{Colors.DIM}│{Colors.RESET} Message:    {Colors.RED}{error_msg}{Colors.RESET}")

    if duration_ms > 0:
        print(f"{Colors.DIM}│{Colors.RESET} Duration:   {Colors.CYAN}{duration_ms:.2f}ms{Colors.RESET}")

    print(f"{Colors.DIM}└─ {Colors.RESET}")

    _tracker.log_request(endpoint, "unknown", 0, success=False,
                        rate_limited=is_rate_limit, duration_ms=duration_ms)


def print_metrics_summary():
    """Print overall metrics summary"""
    _tracker.print_summary()
    _tracker.print_summary_by_model()


def get_metrics_tracker():
    """Get the global metrics tracker instance"""
    return _tracker
