"use client";

import type React from "react";

import { useState, useRef } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  ArrowLeft,
  Upload,
  CheckCircle2,
  AlertCircle,
  Loader2,
  FileText,
} from "lucide-react";

interface Status {
  watson_assistant: boolean;
  llm_model: boolean;
  simplification_model: boolean;
  index_status: {
    indexed: boolean;
    total_chunks: number;
    documents: string[];
  };
  active_sessions: number;
}

export default function UploadPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);
  const [checking, setChecking] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type === "application/pdf") {
      setFile(selectedFile);
      setError(null);
    } else {
      setError("Please select a valid PDF file.");
      setFile(null);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(false);

    const formData = new FormData();
    // FastAPI expects 'files' (plural) as the field name
    formData.append("files", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => ({ detail: "Upload failed" }));
        throw new Error(errorData.detail || "Upload failed");
      }

      const result = await response.json();
      setSuccess(true);
      setFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Show success message with details
      if (result.message) {
        console.log("Upload success:", result.message);
      }

      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error";
      setError(`⚠️ ${errorMessage}`);
      console.error("Error:", err);
    } finally {
      setUploading(false);
    }
  };

  const handleCheckStatus = async () => {
    setChecking(true);
    setError(null);

    try {
      const response = await fetch("/api/status");
      if (!response.ok) throw new Error("Failed to get status");

      const data = await response.json();
      setStatus(data);
    } catch (err) {
      setError("⚠️ Could not retrieve status. Please try again.");
      console.error("Error:", err);
    } finally {
      setChecking(false);
    }
  };

  const handleClearIndex = async () => {
    if (
      !confirm(
        "Are you sure you want to clear the index? This cannot be undone."
      )
    )
      return;

    setError(null);
    try {
      const response = await fetch("/api/clear", {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Clear failed");

      setSuccess(true);
      setStatus(null);
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError("⚠️ Failed to clear the index. Please try again.");
      console.error("Error:", err);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="w-4 h-4" />
              Back to Chat
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold text-foreground">
              Upload Legal Documents
            </h1>
            <p className="text-xs text-muted-foreground">
              Enhance the knowledge base with PDFs
            </p>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-8">
          {/* Upload Card */}
          <Card className="p-8">
            <form onSubmit={handleUpload} className="space-y-6">
              <div className="space-y-4">
                <label className="block text-sm font-medium text-foreground">
                  Select PDF Document
                </label>
                <div
                  className="border-2 border-dashed border-border rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-primary/5 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  <div className="space-y-3">
                    <div className="flex justify-center">
                      <Upload className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {file ? file.name : "Click to upload or drag and drop"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        PDF files only
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {file && (
                <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg">
                  <FileText className="w-5 h-5 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {file.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                </div>
              )}

              <Button
                type="submit"
                disabled={!file || uploading}
                className="w-full gap-2"
                size="lg"
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    Upload Document
                  </>
                )}
              </Button>
            </form>
          </Card>

          {/* Status Card */}
          <div className="space-y-4">
            <div className="flex gap-3">
              <Button
                onClick={handleCheckStatus}
                disabled={checking}
                variant="outline"
                className="flex-1 bg-transparent"
              >
                {checking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Checking...
                  </>
                ) : (
                  "Check Status"
                )}
              </Button>
              <Button
                onClick={handleClearIndex}
                variant="destructive"
                className="flex-1"
              >
                Clear Index
              </Button>
            </div>

            {status && (
              <Card className="p-4 bg-secondary/50">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-foreground">
                    System Status
                  </p>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      <strong>Watson Assistant:</strong>{" "}
                      {status.watson_assistant ? "✅ Active" : "❌ Inactive"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      <strong>LLM Model:</strong>{" "}
                      {status.llm_model ? "✅ Active" : "❌ Inactive"}
                    </p>
                    {status.index_status && (
                      <>
                        <p className="text-xs text-muted-foreground">
                          <strong>Indexed:</strong>{" "}
                          {status.index_status.indexed ? "Yes" : "No"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          <strong>Total Chunks:</strong>{" "}
                          {status.index_status.total_chunks}
                        </p>
                        {status.index_status.documents &&
                          status.index_status.documents.length > 0 && (
                            <div className="mt-2">
                              <p className="text-xs text-muted-foreground font-semibold">
                                Documents:
                              </p>
                              <ul className="text-xs text-muted-foreground pl-4 mt-1">
                                {status.index_status.documents.map(
                                  (doc: string, idx: number) => (
                                    <li key={idx}>• {doc}</li>
                                  )
                                )}
                              </ul>
                            </div>
                          )}
                      </>
                    )}
                    <p className="text-xs text-muted-foreground">
                      <strong>Active Sessions:</strong>{" "}
                      {status.active_sessions || 0}
                    </p>
                  </div>
                </div>
              </Card>
            )}
          </div>

          {/* Alerts */}
          {success && (
            <Alert className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription className="text-green-800 dark:text-green-200">
                ✅ Document successfully indexed in FAISS.
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Info Section */}
          <Card className="p-6 bg-primary/5 border-primary/20">
            <div className="space-y-3">
              <h3 className="font-semibold text-foreground">How it works</h3>
              <ul className="text-sm text-muted-foreground space-y-2">
                <li>• Upload PDF documents containing legal information</li>
                <li>• Documents are indexed using FAISS for fast retrieval</li>
                <li>
                  • The chatbot uses indexed documents to answer questions
                </li>
                <li>
                  • You can upload multiple documents to build a comprehensive
                  knowledge base
                </li>
              </ul>
            </div>
          </Card>

          <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 text-center">
            <p className="text-sm text-muted-foreground">
              <strong>Disclaimer:</strong> This information is for general
              guidance. Please consult a certified lawyer for official legal
              advice.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
