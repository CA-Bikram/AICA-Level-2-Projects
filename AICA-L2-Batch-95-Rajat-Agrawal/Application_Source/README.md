# Form 35 Appeal Assistant v2

Python desktop application by Rajat Agrawal: extract assessment-order information, prepare editable appeal drafts, and export a working Form 35 PDF.

## Start on Windows

1. Extract this ZIP into a folder.
2. Install Python 3.11 or newer if it is not installed. The Windows `py` launcher is used by the batch files.
3. Double-click `SETUP_WINDOWS.bat` once (internet is needed to download dependencies).
4. Double-click `START_WINDOWS.bat`.

Command-line alternative:

```text
py -m pip install -r requirements.txt
py app.py
```

The old executable does not include these changes. This package contains updated source, not a rebuilt Windows executable. To build a new executable on Windows, run `BUILD_WINDOWS_EXE.bat`. The result will be in `dist`. The build script is provided but has not been tested on Windows here.

## Offline template mode

Load PDFs or drag them into the window. Extraction uses local text and regex patterns; it is not AI reasoning. Readable PDFs are required; scanned PDFs must be OCR-processed first.

Review extracted values, edit the facts and grounds, and replace all `[CONFIRM: ...]` placeholders. Enter the actual service date yourself; order/demand issue dates are not treated as service dates. Enter the intended filing/verification date. Changing either date recalculates the prototype delay indicator.

In the Reference tab confirm the service date and final review. Changes to material fields reset the final-review flag. Source-document changes and regeneration also reset it. Conflicting PAN/assessment-year documents block export. Word-limit violations, unresolved narrative placeholders and missing review confirmation block export.

Form 35 is a working PDF; the app does not file an appeal on the income-tax portal. Blank fields and missing fee-challan details still require attention and may produce additional export warnings. The prototype uses a simple 30-day delay calculation; verify applicable limitation rules, exclusions, holidays, fee, jurisdiction, statutory provisions and grounds professionally. No legal rules were researched or certified as part of this software update.

`Export facts / grounds` saves separate editable UTF-8 text documents into a new timestamped subfolder. These can be opened in Word or a text editor. They are not DOCX files.

## Optional generative AI (local Ollama)

This mode does use a generative model. It is optional and separate from template drafting.

1. Install Ollama from https://ollama.com/download/windows.
2. Download a suitable **local** model with `ollama pull MODEL_NAME`. Internet is needed for installation/download. Model suitability, memory and speed depend on your computer. Small models may not produce adequate tax drafts.
3. Run `ollama list` to obtain the installed model name. Ensure Ollama is running.
4. Add confirmed facts, disputed issues and instructions in the Reference tab's reviewer-notes field.
5. Click `AI draft (local)`, enter the installed model name, and click `Generate and preview`.
6. Check the preview; click Apply only if you want to replace the facts and grounds. Applying resets final review.
7. Review the source quotations/page references and all factual/legal propositions manually.

The application calls only `http://127.0.0.1:11434`, bypasses HTTP proxies and rejects redirects. It checks model metadata and rejects known remote/cloud models. Use a downloaded local model and keep Ollama configured for local execution. The application does not access web research, install/pull models, or provide API keys. It cannot audit an independently altered Ollama service or model definition.

No case-law research is provided. The prompt instructs the model not to invent citations or facts, but prompt instructions do not guarantee correctness. AI reference accuracy is not automatically verified. No external action or filing is performed.

The prototype rejects inputs over 45,000 characters instead of silently trimming them. It requests a 32,768-token context; actual model support and tokenization may vary. Timeouts and model errors leave drafts unchanged. Live local-model generation has not been tested in this environment; the request/response integration was tested with simulated responses.

Official API references: https://docs.ollama.com/api/chat and https://github.com/ollama/ollama/blob/main/docs/api.md.

## Capstone material

Use `sample_data/Fictional_Assessment_Order.pdf`, not real client documents. It is deliberately incomplete: no actual service date, fee challan or full supporting evidence is supplied. For a mock workflow, enter service 05/01/2026 and intended filing 20/01/2026. Those are invented demonstration inputs, not extracted facts.

Read `CAPSTONE_GUIDE.md` for a demonstration sequence. Rename the outer submission folder to the batch/name convention prescribed by ICAI, replacing the batch placeholder with your real batch number. GitHub submission does not publish/deploy the app or file an appeal.

The package intentionally excludes uploaded client PDFs, the older executable, obsolete file-generation scripts and local saved client drafts. Do not publish personal data, credentials or case files.

## Verification

```text
py -m unittest discover -p test_improvements.py -v
```

Eight automated regression tests cover factual assumptions, missing service dates, identity mismatches, output limits, source-size rejection, preserving edits and simulated local-AI responses/remote-model rejection. A headless Qt smoke check also exercised window creation, loading the fictional PDF, editing dates, review validation, the AI dialog and PDF export. Exported PDF pages were visually reviewed. Windows packaging and live Ollama inference remain to be validated on your laptop.
