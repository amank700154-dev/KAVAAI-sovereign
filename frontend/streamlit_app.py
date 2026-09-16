import streamlit as st
import requests
import chromadb
from sentence_transformers import SentenceTransformer
import base64
import os



st.set_page_config(
    page_title="Sovereign Industrial AI",
    page_icon="🏭",
    layout="wide",
    initial_sidebar_state="expanded"
)




st.markdown("""
<style>

#MainMenu {
    visibility: hidden;
}

footer {
    visibility: hidden;
}

header {
    visibility: hidden;
}

.stApp {
    background: #0b0f14;
}

section[data-testid="stSidebar"] {
    background: #10151c;
    border-right: 1px solid #252c35;
}

.main-title {
    font-size: 38px;
    font-weight: 750;
    color: #f8fafc;
    letter-spacing: -1px;
    margin-bottom: 4px;
}

.main-subtitle {
    color: #8793a1;
    font-size: 14px;
    margin-bottom: 28px;
}

.status-online {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #12251c;
    border: 1px solid #214d35;
    color: #62d995;
    padding: 8px 13px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 600;
}

.card {
    background: #111820;
    border: 1px solid #242d38;
    border-radius: 12px;
    padding: 20px;
    height: 100%;
}

.card-label {
    color: #7f8b99;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.8px;
    margin-bottom: 10px;
}

.card-value {
    color: #f1f5f9;
    font-size: 25px;
    font-weight: 700;
}

.card-small {
    color: #7f8b99;
    font-size: 12px;
    margin-top: 6px;
}

.section-title {
    color: #f1f5f9;
    font-size: 21px;
    font-weight: 650;
    margin-top: 28px;
    margin-bottom: 14px;
}

.pipeline {
    background: #111820;
    border: 1px solid #242d38;
    border-radius: 12px;
    padding: 22px;
}

.pipeline-step {
    color: #d7dee7;
    font-size: 14px;
    padding: 9px 0;
}

.machine-status {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #111820;
    border: 1px solid #242d38;
    border-radius: 12px;
    padding: 18px 22px;
}

.machine-name {
    color: #f1f5f9;
    font-size: 18px;
    font-weight: 650;
}

.machine-type {
    color: #7f8b99;
    font-size: 12px;
    margin-top: 4px;
}

.evidence {
    background: #111820;
    border: 1px solid #242d38;
    border-radius: 12px;
    padding: 18px;
    min-height: 150px;
}

.evidence-title {
    color: #f1f5f9;
    font-size: 15px;
    font-weight: 650;
    margin-bottom: 10px;
}

.evidence-text {
    color: #9ba6b3;
    font-size: 13px;
    line-height: 1.6;
}

</style>
""", unsafe_allow_html=True)



with st.sidebar:

    st.markdown(
        '<div style="font-size:21px;font-weight:700;color:#f1f5f9;">'
        'SOVEREIGN AI'
        '</div>',
        unsafe_allow_html=True
    )

    st.markdown(
        '<div style="font-size:12px;color:#7f8b99;margin-bottom:30px;">'
        'Industrial Intelligence Workbench'
        '</div>',
        unsafe_allow_html=True
    )

    page = st.radio(
        "WORKBENCH",
        [
            "Overview",
            "Investigation",
            "Documents",
            "Vision"
        ]
    )

    st.divider()

    st.markdown("### SYSTEM")

    st.markdown(
        '<div class="status-online">● Local AI Online</div>',
        unsafe_allow_html=True
    )

    st.write("")

    st.caption("LLM")
    st.write("Qwen2.5 7B")

    st.caption("VISION")
    st.write("Qwen2.5-VL 7B")

    st.caption("RAG")
    st.write("ChromaDB")

    st.caption("DEPLOYMENT")
    st.write("On-Premise")




if page == "Overview":

    st.markdown(
        '<div class="main-title">Industrial AI Workbench</div>',
        unsafe_allow_html=True
    )

    st.markdown(
        '<div class="main-subtitle">'
        'Sovereign, multimodal intelligence for confidential industrial operations'
        '</div>',
        unsafe_allow_html=True
    )

    st.markdown(
        """
        <div class="machine-status">
            <div>
                <div class="machine-name">Machine 101</div>
                <div class="machine-type">Industrial Cooling Unit</div>
            </div>

            <div class="status-online">
                ● SYSTEM ONLINE
            </div>
        </div>
        """,
        unsafe_allow_html=True
    )

    st.markdown(
        '<div class="section-title">System Overview</div>',
        unsafe_allow_html=True
    )

    col1, col2, col3, col4 = st.columns(4)

    with col1:
        st.markdown(
            """
            <div class="card">
                <div class="card-label">AI Status</div>
                <div class="card-value">ONLINE</div>
                <div class="card-small">
                    Local inference active
                </div>
            </div>
            """,
            unsafe_allow_html=True
        )

    with col2:
        st.markdown(
            """
            <div class="card">
                <div class="card-label">Machine</div>
                <div class="card-value">101</div>
                <div class="card-small">
                    Cooling Unit
                </div>
            </div>
            """,
            unsafe_allow_html=True
        )

    with col3:
        st.markdown(
            """
            <div class="card">
                <div class="card-label">Documents</div>
                <div class="card-value">1</div>
                <div class="card-small">
                    Indexed in ChromaDB
                </div>
            </div>
            """,
            unsafe_allow_html=True
        )

    with col4:
        st.markdown(
            """
            <div class="card">
                <div class="card-label">Deployment</div>
                <div class="card-value">LOCAL</div>
                <div class="card-small">
                    On-premise inference
                </div>
            </div>
            """,
            unsafe_allow_html=True
        )

    st.markdown(
        '<div class="section-title">Agent Pipeline</div>',
        unsafe_allow_html=True
    )

    st.markdown(
        """
        <div class="pipeline">

        <div class="pipeline-step">
        <b>01</b> &nbsp; User Question →
        </div>

        <div class="pipeline-step">
        <b>02</b> &nbsp; Agent Decision →
        </div>

        <div class="pipeline-step">
        <b>03</b> &nbsp; Manual Search + Vision Analysis →
        </div>

        <div class="pipeline-step">
        <b>04</b> &nbsp; Evidence Fusion →
        </div>

        <div class="pipeline-step">
        <b>05</b> &nbsp; Industrial Investigation
        </div>

        </div>
        """,
        unsafe_allow_html=True
    )




elif page == "Investigation":

    st.markdown(
        '<div class="main-title">Investigation</div>',
        unsafe_allow_html=True
    )

    st.markdown(
        '<div class="main-subtitle">'
        'Ask the local AI agent to investigate an industrial machine'
        '</div>',
        unsafe_allow_html=True
    )

    question = st.text_area(
        "QUESTION",
        placeholder="Example: Is Machine 101 overheating?",
        height=110
    )

    image = st.file_uploader(
        "MACHINE IMAGE",
        type=["png", "jpg", "jpeg"]
    )

    if st.button(
        "Run Investigation",
        type="primary",
        use_container_width=True
    ):

        if not question:

            st.warning("Please enter a question.")

        else:


            with st.spinner("Agent is deciding which tools to use..."):

                decision_prompt = f"""
You are an industrial AI decision-making agent.

User question:
{question}

Available tools:

MANUAL_SEARCH
IMAGE_ANALYSIS
BOTH

Choose MANUAL_SEARCH for:
maintenance procedures, specifications,
temperature limits, maintenance schedules,
or written instructions.

Choose IMAGE_ANALYSIS for:
visible damage, cracks, leaks, blockage,
or component appearance.

Choose BOTH when the question requires
information from the manual AND information
visible in the image.

Example:
Is Machine 101 overheating?
BOTH

Return ONLY:
MANUAL_SEARCH
IMAGE_ANALYSIS
or
BOTH
"""

                decision_response = requests.post(
                    "http://localhost:11434/api/generate",
                    json={
                        "model": "qwen2.5:7b",
                        "prompt": decision_prompt,
                        "stream": False
                    }
                )

                decision = decision_response.json()["response"].strip()

            st.markdown(
                '<div class="section-title">Agent Plan</div>',
                unsafe_allow_html=True
            )

            st.success(
                f"Agent decision: {decision}"
            )



            manual_context = ""

            if (
                "MANUAL_SEARCH" in decision
                or "BOTH" in decision
            ):

                with st.spinner("Searching maintenance knowledge..."):

                    embedding_model = SentenceTransformer(
                        "all-MiniLM-L6-v2"
                    )

                    client = chromadb.PersistentClient(
                        path="./chroma_db"
                    )

                    collection = client.get_collection(
                        name="industrial_documents"
                    )

                    query_embedding = embedding_model.encode(
                        [question]
                    ).tolist()

                    results = collection.query(
                        query_embeddings=query_embedding,
                        n_results=2
                    )

                    manual_context = "\n\n".join(
                        results["documents"][0]
                    )

                st.success("✓ Manual evidence retrieved")




            image_analysis = ""

            if (
                "IMAGE_ANALYSIS" in decision
                or "BOTH" in decision
            ):

                if image is None:

                    st.warning(
                        "Image analysis was selected, "
                        "but no machine image was uploaded."
                    )

                else:

                    with st.spinner(
                        "Analyzing machine image..."
                    ):

                        image_base64 = base64.b64encode(
                            image.getvalue()
                        ).decode("utf-8")

                        image_prompt = f"""
Analyze this industrial machine image.

User question:
{question}

Only describe information actually visible
in the image.

Do not guess measurements.
Do not invent information.
"""

                        image_response = requests.post(
                            "http://localhost:11434/api/generate",
                            json={
                                "model": "qwen2.5vl:7b",
                                "prompt": image_prompt,
                                "images": [image_base64],
                                "stream": False
                            }
                        )

                        image_analysis = (
                            image_response
                            .json()["response"]
                        )

                    st.success("✓ Image evidence retrieved")



            with st.spinner(
                "Combining evidence and generating assessment..."
            ):

                final_prompt = f"""
You are an industrial maintenance AI assistant.

Answer the user's question using ONLY the
evidence provided.

USER QUESTION:
{question}

========================
MANUAL EVIDENCE
========================

{manual_context}

========================
IMAGE EVIDENCE
========================

{image_analysis}

========================
RULES
========================

Do not invent information.

Clearly distinguish observations from
manual information.

If the evidence is insufficient, say so.

Provide:

ASSESSMENT

RECOMMENDATION

Keep the answer concise and practical.
"""

                final_response = requests.post(
                    "http://localhost:11434/api/generate",
                    json={
                        "model": "qwen2.5vl:7b",
                        "prompt": final_prompt,
                        "stream": False
                    }
                )

                answer = final_response.json()["response"]


   

            st.markdown(
                '<div class="section-title">Evidence</div>',
                unsafe_allow_html=True
            )

            col1, col2 = st.columns(2)

            with col1:

                st.markdown(
                    """
                    <div class="evidence">

                    <div class="evidence-title">
                    📄 Manual Evidence
                    </div>

                    <div class="evidence-text">
                    """,
                    unsafe_allow_html=True
                )

                if manual_context:
                    st.write(manual_context)
                else:
                    st.write("No manual evidence used.")

                st.markdown(
                    "</div></div>",
                    unsafe_allow_html=True
                )


            with col2:

                st.markdown(
                    """
                    <div class="evidence">

                    <div class="evidence-title">
                    🖼 Vision Evidence
                    </div>

                    <div class="evidence-text">
                    """,
                    unsafe_allow_html=True
                )

                if image_analysis:
                    st.write(image_analysis)
                else:
                    st.write("No image evidence used.")

                st.markdown(
                    "</div></div>",
                    unsafe_allow_html=True
                )



            st.markdown(
                '<div class="section-title">'
                'Industrial Assessment'
                '</div>',
                unsafe_allow_html=True
            )

            st.markdown(
                """
                <div class="evidence">
                """,
                unsafe_allow_html=True
            )

            st.write(answer)

            st.markdown(
                "</div>",
                unsafe_allow_html=True
            )



elif page == "Documents":

    st.markdown(
        '<div class="main-title">Documents</div>',
        unsafe_allow_html=True
    )

    st.markdown(
        '<div class="main-subtitle">'
        'Industrial manuals and technical knowledge'
        '</div>',
        unsafe_allow_html=True
    )

    st.markdown(
        """
        <div class="card">

        <div class="card-label">
        INDEXED KNOWLEDGE BASE
        </div>

        <div class="card-value">
        Machine 101 Manual
        </div>

        <div class="card-small">
        Maintenance information stored in ChromaDB
        </div>

        </div>
        """,
        unsafe_allow_html=True
    )

    st.markdown(
        '<div class="section-title">Upload Document</div>',
        unsafe_allow_html=True
    )

    uploaded = st.file_uploader(
        "Add technical documentation",
        type=["txt", "pdf", "docx"]
    )

    if uploaded:

        st.success(
            f"Selected: {uploaded.name}"
        )


elif page == "Vision":

    st.markdown(
        '<div class="main-title">Machine Vision</div>',
        unsafe_allow_html=True
    )

    st.markdown(
        '<div class="main-subtitle">'
        'Multimodal inspection using Qwen2.5-VL'
        '</div>',
        unsafe_allow_html=True
    )

    image = st.file_uploader(
        "Upload machine image",
        type=["png", "jpg", "jpeg"]
    )

    if image:

        col1, col2 = st.columns(2)

        with col1:

            st.image(
                image,
                caption="Machine Image",
                use_container_width=True
            )

        with col2:

            st.markdown(
                """
                <div class="evidence">

                <div class="evidence-title">
                Vision Analysis Ready
                </div>

                <div class="evidence-text">

                Model: Qwen2.5-VL 7B

                <br><br>

                This image can be analyzed locally
                without sending the industrial image
                to a cloud service.

                </div>

                </div>
                """,
                unsafe_allow_html=True
            )