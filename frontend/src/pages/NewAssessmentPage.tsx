import { ChangeEvent, DragEvent, useMemo, useRef, useState } from 'react';
import { Button } from '../components/Button';
import { createAssessment } from '../lib/api';
import { Assessment } from '../types';

type UploadedFileItem = {
  id: string;
  file: File;
};

function createFileId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2)}`;
}

function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const size = bytes / Math.pow(1024, index);
  return `${size.toFixed(index === 0 ? 0 : 2)} ${units[index]}`;
}

export function NewAssessmentPage({ onCreated }: { onCreated: (assessment: Assessment) => void }) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [systemDescription, setSystemDescription] = useState('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const canGenerate = useMemo(() => systemDescription.trim().length > 0 || uploadedFiles.length > 0, [systemDescription, uploadedFiles]);

  function addFiles(fileList: FileList | null) {
    const selectedFiles = Array.from(fileList ?? []);
    if (!selectedFiles.length) return;

    setUploadedFiles((current) => {
      const existing = new Set(current.map((item) => `${item.file.name}-${item.file.size}-${item.file.lastModified}`));
      const newItems = selectedFiles
        .filter((file) => !existing.has(`${file.name}-${file.size}-${file.lastModified}`))
        .map((file) => ({ id: createFileId(file), file }));
      return [...current, ...newItems];
    });
    setMessage('');
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    addFiles(event.target.files);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    addFiles(event.dataTransfer.files);
  }

  function clearFiles() {
    setUploadedFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function submit() {
    if (!canGenerate) {
      setMessage('Please enter a system description or upload at least one document.');
      return;
    }

    setLoading(true);
    setMessage('Generating assessment. This may take a while for large documents...');

    try {
      const formData = new FormData();
      formData.append('systemDescription', systemDescription);
      uploadedFiles.forEach((item) => formData.append('files', item.file));
      const data = await createAssessment(formData);
      setMessage('Assessment generated successfully.');
      onCreated(data.assessment);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Assessment failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="pageHeader compactHeader">
        <h1>New Assessment</h1>
        <p>Evaluate a new AI system or proposed use case.</p>
      </div>

      <section className="assessmentCard">
        <div className="assessmentCardHeader">
          <h2>♢ AI System Details</h2>
          <p>
            Describe the AI system, its intended use case, data sources, and target users. Upload supporting documents to improve the evidence matching against the vector stores.
          </p>
        </div>

        <div className="assessmentCardBody">
          <label className="fieldLabel strongLabel">
            System Description
            <span>Include model type, data sources, user base, and level of autonomy.</span>
            <textarea
              value={systemDescription}
              onChange={(event) => setSystemDescription(event.target.value)}
              rows={8}
              placeholder="e.g. We are building an internal HR chatbot that uses an LLM to answer employee policy questions based on our handbook. It does not take actions, but handles sensitive inquiries."
            />
          </label>

          <div className="uploadSection">
            <div className="uploadLabel">
              <strong>Upload Supporting Documents</strong>
              <span>Multiple files are supported. Any format can be selected; text-readable formats work best.</span>
            </div>

            <input ref={fileInputRef} type="file" multiple hidden onChange={handleFileChange} />

            <div
              className={`dropZone ${isDragging ? 'dragging' : ''}`}
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              <div className="uploadIcon">↑</div>
              <strong>Click to upload documents or drag and drop files here</strong>
              <span>PDF, DOCX, XLSX, CSV, TXT, Markdown, JSON, XML, HTML, logs, and other file types can be uploaded.</span>
            </div>

            {uploadedFiles.length > 0 && (
              <div className="fileList">
                <div className="fileListHeader">
                  <strong>Uploaded files ({uploadedFiles.length})</strong>
                  <button onClick={clearFiles}>Clear all</button>
                </div>
                {uploadedFiles.map((item) => (
                  <div className="fileItem" key={item.id}>
                    <div>
                      <strong>{item.file.name}</strong>
                      <span>{formatFileSize(item.file.size)}</span>
                    </div>
                    <button onClick={() => setUploadedFiles((current) => current.filter((file) => file.id !== item.id))}>Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {message && <div className="infoBox">{message}</div>}

          <div className="buttonRow right">
            <Button className="primary large" onClick={submit} disabled={!canGenerate || loading}>
              ＋ {loading ? 'Generating Assessment...' : 'Generate Assessment'}
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
