"""
Streamlit App - CV Skill Extraction

This is the main Streamlit application for the CV Skill Extraction web app.
Users can upload a PDF CV and extract professional skills using AI.
"""

import streamlit as st
from pdf_utils import extract_text_from_pdf
from main import call_huggingface_api, parse_skills_from_response
import time


# Page configuration
st.set_page_config(
    page_title="CV Skill Extractor",
    page_icon="🧠",
    layout="wide"
)

# Title and description
st.title("🧠 AI CV Skill Extractor")
st.markdown("""
Upload your CV as a PDF file and let AI extract your professional skills automatically!
""")

# Sidebar for instructions and model selection
with st.sidebar:
    st.header("📋 Instructions")
    st.markdown("""
    1. **Upload PDF**: Click the uploader below and select your CV PDF file
    2. **Extract Text**: The app will automatically extract text from your PDF
    3. **Select Model**: Choose a model from the dropdown below
    4. **Get Skills**: Click the button to send your CV to AI and extract skills
    5. **View Results**: See your extracted skills displayed below
    
    **Note**: Make sure you have set your Hugging Face API token in the `.env` file.
    """)
    
    st.markdown("---")
    st.header("⚙️ Settings")
    
    # Model selection dropdown
    # Using OpenAI-compatible models via Hugging Face router
    available_models = [
        "openai/gpt-oss-120b:groq",
        "meta-llama/Llama-3.1-8B-Instruct",
        "mistralai/Mistral-7B-Instruct-v0.2",
        "google/gemma-2b-it",
        "gpt2",
    ]
    
    # Get default model from environment or use openai/gpt-oss-120b:groq
    import os
    from dotenv import load_dotenv
    load_dotenv()
    default_model = os.getenv("HF_MODEL", "openai/gpt-oss-120b:groq")
    
    # Option to use custom model
    use_custom = st.checkbox("Use Custom Model", help="Enter a custom Hugging Face model name")
    
    if use_custom:
        custom_model = st.text_input(
            "Custom Model Name",
            value=default_model if default_model not in available_models else "",
            placeholder="e.g., mistralai/Mistral-7B-Instruct-v0.2",
            help="Enter the full model name from Hugging Face (e.g., organization/model-name)"
        )
        if custom_model:
            selected_model = custom_model
        else:
            selected_model = default_model
            st.warning("⚠️ Please enter a model name or uncheck 'Use Custom Model'")
    else:
        selected_model = st.selectbox(
            "🤖 Select Model",
            options=available_models,
            index=available_models.index(default_model) if default_model in available_models else 0,
            help="Choose a Hugging Face model for skill extraction"
        )
    
    # Store selected model in session state
    if 'selected_model' not in st.session_state:
        st.session_state.selected_model = selected_model
    else:
        st.session_state.selected_model = selected_model
    
    st.markdown("---")
    st.markdown(f"**Current Model**: `{selected_model}`")
    st.markdown("**Powered by**: Hugging Face Inference API")

# File uploader
uploaded_file = st.file_uploader(
    "Upload your CV (PDF format)",
    type=['pdf'],
    help="Select a PDF file containing your CV"
)

# Initialize session state for storing extracted data
if 'cv_text' not in st.session_state:
    st.session_state.cv_text = None
if 'skills' not in st.session_state:
    st.session_state.skills = None

# Process uploaded file
if uploaded_file is not None:
    st.success(f"✅ File uploaded: {uploaded_file.name}")
    
    # Extract text from PDF
    with st.spinner("Extracting text from PDF..."):
        cv_text = extract_text_from_pdf(uploaded_file)
        
        if cv_text:
            st.session_state.cv_text = cv_text
            st.success("✅ Text extracted successfully!")
            
            # Show extracted text in expander
            with st.expander("📄 View Extracted Text"):
                st.text_area(
                    "CV Text",
                    cv_text,
                    height=200,
                    disabled=True,
                    label_visibility="collapsed"
                )
        else:
            st.error("❌ Failed to extract text from PDF. Please check if the file is valid.")
            st.session_state.cv_text = None

# Extract skills button
if st.session_state.cv_text:
    st.markdown("---")
    
    if st.button("🚀 Extract Skills", type="primary", use_container_width=True):
        # Get the selected model (ensure it's set)
        selected_model = st.session_state.get('selected_model', 'openai/gpt-oss-120b:groq')
        with st.spinner(f"🤖 Sending CV to {selected_model} for skill extraction..."):
            try:
                # Call Hugging Face API with selected model
                api_response = call_huggingface_api(cv_text=st.session_state.cv_text, model_name=selected_model)
                
                if api_response:
                    # Parse skills from response
                    skills = parse_skills_from_response(api_response)
                    st.session_state.skills = skills
                    
                    st.success(f"✅ Successfully extracted {len(skills)} skills!")
                else:
                    st.error("❌ Failed to extract skills. No response from API.")
                    st.session_state.skills = None
            except Exception as e:
                error_message = str(e)
                st.error(f"❌ Error: {error_message}")
                
                # Provide helpful suggestions based on error type
                if "loading" in error_message.lower():
                    st.info("💡 **Tip**: The model is loading. Wait 10-20 seconds and try again. This happens the first time you use a model.")
                elif "401" in error_message or "unauthorized" in error_message.lower():
                    st.info("💡 **Tip**: Check your Hugging Face API token in the `.env` file.")
                elif "404" in error_message:
                    st.info("💡 **Tip**: The model might not be available. Try checking the model name: `mistralai/Mistral-7B-Instruct-v0.2`")
                
                st.session_state.skills = None

# Display extracted skills
if st.session_state.skills:
    st.markdown("---")
    st.header("📊 Extracted Skills")
    
    # Show skills count
    st.metric("Total Skills Found", len(st.session_state.skills))
    
    # Display skills in columns
    num_columns = 3
    cols = st.columns(num_columns)
    
    for idx, skill in enumerate(st.session_state.skills):
        with cols[idx % num_columns]:
            st.markdown(f"- **{skill}**")
    
    # Show raw API response in expander
    with st.expander("🔍 View Raw API Response"):
        st.code(st.session_state.cv_text[:500] + "..." if len(st.session_state.cv_text) > 500 else st.session_state.cv_text)

# Footer
st.markdown("---")
st.markdown(
    "<div style='text-align: center; color: gray;'>Made with ❤️ using Streamlit and Hugging Face</div>",
    unsafe_allow_html=True
)
