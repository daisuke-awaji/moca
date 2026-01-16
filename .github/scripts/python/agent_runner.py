#!/usr/bin/env python3
"""
Strands GitHub Agent Runner
"""

import json
import os
from typing import Any

from strands import Agent
from strands.models.bedrock import BedrockModel
from botocore.config import Config

from strands_tools import http_request, shell

from github_tools import (
    add_issue_comment,
    create_issue,
    create_pull_request,
    get_issue,
    get_issue_comments,
    get_pull_request,
    get_pr_review_and_comments,
    list_issues,
    list_pull_requests,
    reply_to_review_comment,
    update_issue,
    update_pull_request,
)

from str_replace_based_edit_tool import str_replace_based_edit_tool
from notebook import notebook
from handoff_to_user import handoff_to_user

STRANDS_MODEL_ID = "anthropic.claude-opus-4-20250514-v1:0"
STRANDS_MAX_TOKENS = 64000
STRANDS_BUDGET_TOKENS = 8000
STRANDS_REGION = "ap-northeast-1"

DEFAULT_SYSTEM_PROMPT = "You are an autonomous GitHub agent."


def _get_all_tools() -> list[Any]:
    return [
        str_replace_based_edit_tool,
        shell,
        http_request,
        create_issue,
        get_issue,
        update_issue,
        list_issues,
        add_issue_comment,
        get_issue_comments,
        create_pull_request,
        get_pull_request,
        update_pull_request,
        list_pull_requests,
        get_pr_review_and_comments,
        reply_to_review_comment,
        notebook,
        handoff_to_user,
    ]


def run_agent(query: str):
    """Run the agent with the provided query."""
    try:
        tools = _get_all_tools()

        additional_request_fields = {
            "anthropic_beta": ["interleaved-thinking-2025-05-14"],
            "thinking": {
                "type": "enabled",
                "budget_tokens": STRANDS_BUDGET_TOKENS
            }
        }

        model = BedrockModel(
            model_id=STRANDS_MODEL_ID,
            max_tokens=STRANDS_MAX_TOKENS,
            region_name=STRANDS_REGION,
            boto_client_config=Config(
                read_timeout=900,
                connect_timeout=900,
                retries={"max_attempts": 3, "mode": "adaptive"},
            ),
            additional_request_fields=additional_request_fields,
        )

        system_prompt = os.getenv("INPUT_SYSTEM_PROMPT", DEFAULT_SYSTEM_PROMPT)

        agent = Agent(
            model=model,
            system_prompt=system_prompt,
            tools=tools,
        )

        print(f"🤖 Running agent with query: {query[:100]}...")
        result = agent(query)
        print(f"✅ Agent completed successfully")
        return result

    except Exception as e:
        print(f"❌ Error running agent: {e}")
        raise


def main():
    task_prompt = os.getenv("INPUT_TASK_PROMPT", "")
    if not task_prompt:
        print("❌ No task prompt provided")
        return

    print("=" * 60)
    print("🚀 Starting Strands Agent")
    print("=" * 60)
    print(f"Model: {STRANDS_MODEL_ID}")
    print(f"Region: {STRANDS_REGION}")
    print(f"Task: {task_prompt[:200]}...")
    print("=" * 60)

    run_agent(task_prompt)


if __name__ == "__main__":
    main()
