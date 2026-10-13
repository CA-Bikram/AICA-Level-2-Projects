# Capstone demonstration guide

Suggested title: **Form 35 Appeal Preparation Assistant with Optional Local Generative AI**

## Problem

Appeal preparation involves extracting identifiers and figures, organising case facts, drafting grounds and checking missing information. Repetitive data entry consumes professional time; unsupported template assertions can introduce factual errors.

## What this prototype demonstrates

- Python/PyQt desktop application and local PDF extraction.
- Editable Form 35 fields and working PDF export.
- Safer template drafting with reviewer-controlled facts.
- Optional local-model generative drafting through Ollama.
- Human review, source-page markers, identity-conflict checks and word-limit validation.
- Separate editable text exports for facts, grounds and condonation where relevant.

## Demonstration sequence

1. Introduce yourself, the problem and the application. Keep your face and screen visible as required by the course.
2. Open the app and load the fictional sample order.
3. Show the extracted PAN, assessment year, returned income, assessed income and addition.
4. Show that service date is blank. Explain why the issue date does not establish service.
5. Enter the fictional service and intended filing dates from the README. Show recalculated delay.
6. Show the `[CONFIRM: ...]` placeholder. Explain that the app no longer asserts a hearing denial from a keyword alone.
7. In template mode, review and replace the placeholder with confirmed fictional facts.
8. If a local model has actually been installed and tested, demonstrate AI generation and the preview. Explain the difference between a template and a generative model. Do not claim live AI generation if you only demonstrate template mode.
9. Inspect AI review notes and source passages. Explain that references and legal reasoning require professional review.
10. Confirm service and review in Reference data; export the working PDF and separate facts/grounds text documents. Show the output files.
11. Explain limitations: readable PDFs, prototype limitation/fee rules, no portal filing, no verified legal research and no guaranteed draft accuracy.

## Before submission

- Test the complete workflow on your Windows laptop.
- If claiming AI functionality, test it using a downloaded local model and fictional cases with different issues.
- Enter your actual batch number and name in the prescribed outer folder name.
- Review the README, project files and video links against the latest instructions supplied by your batch.
- Upload project files to your fork, create the pull request and complete the submission form.
- Do not include real client PDFs, personal data, API keys, model weights, virtual environments or saved case drafts.

Course acceptance and grading are determined by ICAI. This guide does not promise approval or marks.
