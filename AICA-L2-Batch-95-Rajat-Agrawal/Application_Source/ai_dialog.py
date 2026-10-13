from PyQt6.QtCore import QThread, pyqtSignal
from PyQt6.QtWidgets import QDialog, QVBoxLayout, QLabel, QLineEdit, QPushButton, QPlainTextEdit, QMessageBox
from data_models import AppealData
import ai_client

class Worker(QThread):
    completed = pyqtSignal(object)
    failed = pyqtSignal(str)
    def __init__(self, data, docs, model, parent):
        super().__init__(parent)
        self.data, self.docs, self.model = data, docs, model
    def run(self):
        try:
            self.completed.emit(ai_client.generate(self.data,self.docs,self.model))
        except Exception as exc:
            self.failed.emit(str(exc))

class AIDraftDialog(QDialog):
    def __init__(self, data, docs, parent=None):
        super().__init__(parent)
        self.setWindowTitle('Optional generative AI - local Ollama')
        self.resize(850,650)
        self.data, self.docs = AppealData.from_dict(data.to_dict()), list(docs)
        self.result_data = None
        self.worker = None
        layout = QVBoxLayout(self)
        label = QLabel('Install Ollama and download a local model first. Cloud models are blocked.\n'
                       'Inputs go to 127.0.0.1 on this computer. Use fictional cases for the capstone.\n'
                       'AI references are suggestions and must be checked against the PDFs.\n'
                       'Existing facts and grounds are replaced only when you click Apply.')
        label.setWordWrap(True)
        layout.addWidget(label)
        self.model = QLineEdit()
        self.model.setPlaceholderText('Installed local model name, exactly as shown by ollama list')
        layout.addWidget(self.model)
        self.generate_button = QPushButton('Generate and preview')
        self.generate_button.clicked.connect(self.start)
        layout.addWidget(self.generate_button)
        self.preview = QPlainTextEdit()
        self.preview.setReadOnly(True)
        layout.addWidget(self.preview)
        self.apply_button = QPushButton('Apply preliminary drafts - review required')
        self.apply_button.setEnabled(False)
        self.apply_button.clicked.connect(self.accept)
        layout.addWidget(self.apply_button)
    def start(self):
        self.result_data = None
        self.apply_button.setEnabled(False)
        self.generate_button.setEnabled(False)
        self.model.setEnabled(False)
        self.preview.setPlainText('Generating on your computer. This may take several minutes...')
        self.worker = Worker(self.data,self.docs,self.model.text(),self)
        self.worker.completed.connect(self.on_generated)
        self.worker.failed.connect(self.failed)
        self.worker.finished.connect(self.finished_work)
        self.worker.start()
    def on_generated(self, result):
        self.result_data = result
        self.preview.setPlainText('STATEMENT OF FACTS\n\n'+result['statement_of_facts']+'\n\nGROUNDS\n\n'+result['grounds_of_appeal']+'\n\nREVIEW NOTES\n\n'+result['review_notes'])
    def failed(self, message):
        self.preview.setPlainText('No draft applied.\n\n'+message+'\n\nCheck Ollama is running and the model is installed locally.')
    def finished_work(self):
        self.generate_button.setEnabled(True)
        self.model.setEnabled(True)
        self.apply_button.setEnabled(self.result_data is not None)
    def reject(self):
        if self.worker and self.worker.isRunning():
            QMessageBox.information(self,'AI running','Please wait for completion or the request timeout before closing.')
            return
        super().reject()
