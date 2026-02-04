# 🧠 AI CV Skill Extractor

A web application built with Streamlit that uses AI to automatically extract professional skills from CV/Resume PDF files.

## Features

- 📄 Upload CV as PDF file
- 🔍 Automatic text extraction from PDF
- 🤖 AI-powered skill extraction using Mistral-7B-Instruct model
- 📊 Clean display of extracted skills
- 🔐 Secure API token management

## Prerequisites

- Python 3.8 or higher
- Hugging Face account with API token

## Installation

1. **Clone or download this project**

2. **Install dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Set up your API token**:
   - Copy `.env.example` to `.env`
   - Get your Hugging Face API token from: https://huggingface.co/settings/tokens
   - Paste your token in the `.env` file:
     ```
     HF_TOKEN=your_actual_token_here
     ```

## Usage

1. **Run the Streamlit app**:
   ```bash
   streamlit run app.py
   ```

2. **Open your browser**:
   - The app will automatically open in your default browser
   - Or navigate to `http://localhost:8501`

3. **Upload your CV**:
   - Click "Upload your CV (PDF format)"
   - Select a PDF file containing your CV
   - Wait for text extraction

4. **Extract skills**:
   - Click the "🚀 Extract Skills" button
   - Wait for AI processing
   - View your extracted skills!

## Project Structure

```
cv_skill_app/
├── app.py              # Streamlit web interface
├── main.py             # Hugging Face API integration
├── pdf_utils.py        # PDF text extraction utilities
├── requirements.txt    # Python dependencies
├── .env.example        # Example environment file
└── README.md          # This file
```

## How It Works

1. **PDF Upload**: User uploads a PDF file through Streamlit interface
2. **Text Extraction**: `pdf_utils.py` extracts text content from the PDF using `pypdf`
3. **AI Processing**: `main.py` sends the CV text to Hugging Face Inference API with Mistral-7B-Instruct model
4. **Skill Extraction**: The AI model analyzes the CV and returns a list of professional skills
5. **Display**: Extracted skills are parsed and displayed in a user-friendly format

## Technologies Used

- **Streamlit**: Web framework for the user interface
- **Hugging Face Inference API**: AI model hosting and inference
- **Mistral-7B-Instruct-v0.3**: Large language model for skill extraction
- **pypdf**: PDF text extraction library
- **python-dotenv**: Environment variable management
- **requests**: HTTP library for API calls

## Notes

- The app uses the Hugging Face Inference API, which may have rate limits depending on your account type
- Processing time depends on the length of your CV and API response time
- Make sure your PDF contains readable text (not just images)

## Troubleshooting

- **"HF_TOKEN not found"**: Make sure you've created a `.env` file with your token
- **API errors**: Check that your Hugging Face token is valid and has access to the model
- **PDF extraction fails**: Ensure your PDF contains extractable text (not just scanned images)

## License

This project is open source and available for educational purposes.
