"""
Main Module - Hugging Face API Integration

This module handles communication with the Hugging Face Inference API
to extract skills from CV text using OpenAI-compatible API.
"""

import os
from typing import Optional, List
from dotenv import load_dotenv

try:
    from openai import OpenAI
except ImportError as e:
    raise ImportError(
        "The 'openai' package is not installed. Please install it by running:\n"
        "  pip install openai>=1.0.0\n"
        "Or install all requirements:\n"
        "  pip install -r requirements.txt\n\n"
        f"Original error: {e}"
    ) from e

# Load environment variables from .env file
load_dotenv()


def call_huggingface_api(cv_text: str, model_name: Optional[str] = None) -> Optional[str]:
    """
    Send CV text to Hugging Face Inference API and get extracted skills.
    
    Args:
        cv_text: The text content extracted from the CV PDF
        model_name: Optional model name. If not provided, uses HF_MODEL from .env or defaults to "gpt2"
        
    Returns:
        str: Response from the API containing extracted skills
    """
    # Get API token from environment variable
    api_token = os.getenv("HF_TOKEN")
    
    if not api_token:
        raise ValueError("HF_TOKEN not found in environment variables. Please check your .env file.")
    
    # Get model name from parameter, environment variable, or use default
    if model_name is None:
        model_name = os.getenv("HF_MODEL", "openai/gpt-oss-120b:groq")  # Default model
    
    if not model_name:
        model_name = "openai/gpt-oss-120b:groq"  # Final fallback
    
    # Initialize OpenAI client with Hugging Face router endpoint
    client = OpenAI(
        base_url="https://router.huggingface.co/v1",
        api_key=api_token,
    )
    
    # Prompt for skill extraction
    prompt = f"""Extract professional skills from this CV text. Return only a Python list format: ['skill1', 'skill2', 'skill3']

CV Text:
{cv_text}"""
    
    try:
        # Use chat completions API (OpenAI-compatible format)
        completion = client.chat.completions.create(
            model=model_name,
            messages=[
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            max_tokens=700,
            temperature=0.3,
        )
        
        # Extract the response
        if completion.choices and len(completion.choices) > 0:
            generated_text = completion.choices[0].message.content
            return generated_text.strip()
        else:
            raise Exception("No response from API")
    
    except Exception as e:
        error_msg = str(e)
        
        # Provide helpful error messages
        if "404" in error_msg or "not found" in error_msg.lower():
            raise Exception(
                f"Model '{model_name}' not found or not available.\n\n"
                f"Please check:\n"
                f"1. The model name is correct: {model_name}\n"
                f"2. The model is available at: https://huggingface.co/{model_name.split(':')[0]}\n"
                f"3. Try a different model like 'openai/gpt-oss-120b:groq' or 'gpt2'"
            )
        elif "401" in error_msg or "unauthorized" in error_msg.lower():
            raise Exception(
                "Authentication failed. Please check your HF_TOKEN at https://huggingface.co/settings/tokens"
            )
        elif "rate limit" in error_msg.lower() or "429" in error_msg:
            raise Exception(
                "Rate limit exceeded. Please wait a moment and try again, or upgrade your Hugging Face account."
            )
        else:
            raise Exception(f"Error calling API: {error_msg}\n\nModel: {model_name}\nEndpoint: https://router.huggingface.co/v1")


def parse_skills_from_response(api_response: str) -> List[str]:
    """
    Parse skills from the API response string.
    
    The API should return a Python list format like: ['skill1', 'skill2', ...]
    This function extracts and cleans the skills.
    
    Args:
        api_response: Raw response string from the API
        
    Returns:
        List[str]: List of extracted skills
    """
    import re
    
    # Try to find a Python list in the response
    # Look for patterns like ['skill1', 'skill2'] or ["skill1", "skill2"]
    list_pattern = r'\[(.*?)\]'
    match = re.search(list_pattern, api_response, re.DOTALL)
    
    if match:
        list_content = match.group(1)
        # Extract quoted strings
        skills = re.findall(r'["\']([^"\']+)["\']', list_content)
        return [skill.strip() for skill in skills if skill.strip()]
    
    # If no list found, try to extract skills from bullet points or lines
    # Split by common delimiters and clean
    lines = api_response.split('\n')
    skills = []
    for line in lines:
        line = line.strip()
        # Remove common prefixes like "- ", "* ", "• ", numbers, etc.
        line = re.sub(r'^[-*•\d.\s]+', '', line)
        if line and len(line) > 2:  # Filter out very short strings
            skills.append(line)
    
    return skills if skills else [api_response]  # Return original if parsing fails
