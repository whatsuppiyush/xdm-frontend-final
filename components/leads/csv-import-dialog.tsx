"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Upload, X, FileText, AlertCircle, CheckCircle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useUser } from "@/contexts/user-context";

interface CSVImportDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface CSVRow {
  [key: string]: string;
}

interface ParsedLead {
  id: string;
  name: string;
  username: string;
  bio: string;
  followers: number;
  following: number;
  canDM: boolean;
  status: string;
}

export default function CSVImportDialog({ isOpen, onClose, onSuccess }: CSVImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [leadName, setLeadName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [parsedData, setParsedData] = useState<ParsedLead[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const [isValid, setIsValid] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { userId } = useUser();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (selectedFile.type !== "text/csv" && !selectedFile.name.endsWith('.csv')) {
      toast({
        title: "Invalid file type",
        description: "Please select a valid CSV file.",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    parseCSV(selectedFile);
  };

  const parseCSV = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const csv = e.target?.result as string;
        const lines = csv.split('\n');
        
        if (lines.length < 2) {
          setErrors(["CSV file must have at least a header row and one data row"]);
          setIsValid(false);
          return;
        }

        // Parse header
        const header = lines[0].split(',').map(col => col.trim().replace(/"/g, ''));
        setColumns(header);

        // Parse data rows
        const data: ParsedLead[] = [];
        const newErrors: string[] = [];

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;

          const values = line.split(',').map(val => val.trim().replace(/"/g, ''));
          if (values.length !== header.length) {
            newErrors.push(`Row ${i + 1}: Column count mismatch`);
            continue;
          }

          const row: CSVRow = {};
          header.forEach((col, index) => {
            row[col] = values[index];
          });

          // Validate and transform the row
          const lead = validateAndTransformRow(row, i + 1);
          if (lead) {
            data.push(lead);
          }
        }

        setParsedData(data);
        setErrors(newErrors);
        setIsValid(newErrors.length === 0 && data.length > 0);

        if (newErrors.length > 0) {
          toast({
            title: "CSV validation errors",
            description: `Found ${newErrors.length} errors in your CSV file. Please check the details below.`,
            variant: "destructive",
          });
        } else if (data.length > 0) {
          toast({
            title: "CSV parsed successfully",
            description: `Found ${data.length} valid leads in your CSV file.`,
          });
        }

      } catch (error) {
        console.error('Error parsing CSV:', error);
        setErrors(["Failed to parse CSV file. Please check the file format."]);
        setIsValid(false);
      }
    };
    reader.readAsText(file);
  };

  const validateAndTransformRow = (row: CSVRow, rowNumber: number): ParsedLead | null => {
    const errors: string[] = [];

    // Check for required fields
    const hasId = row.id || row.userId || row.user_id;
    const hasUsername = row.username || row.screen_name || row.handle;
    const hasName = row.name || row.display_name;

    if (!hasId && !hasUsername) {
      errors.push(`Row ${rowNumber}: Missing both ID and username`);
    }

    if (!hasName) {
      errors.push(`Row ${rowNumber}: Missing name`);
    }

    if (errors.length > 0) {
      setErrors(prev => [...prev, ...errors]);
      return null;
    }

    // Transform the row
    const lead: ParsedLead = {
      id: hasId || `temp_${rowNumber}`, // Use temporary ID if no ID provided
      name: hasName || "",
      username: hasUsername || "",
      bio: row.bio || row.description || row.bio || "",
      followers: parseInt(row.followers || row.followers_count || "0") || 0,
      following: parseInt(row.following || row.following_count || row.friends_count || "0") || 0,
      canDM: true, // Assume all CSV leads can DM
      status: "Active"
    };

    return lead;
  };

  const handleUpload = async () => {
    if (!file || !isValid || !userId || !leadName.trim()) {
      toast({
        title: "Missing information",
        description: "Please provide a lead name and ensure your CSV is valid.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch("/api/leads/csv-import", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          leadName: leadName.trim(),
          leads: parsedData,
          userId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to import leads");
      }

      const result = await response.json();
      
      toast({
        title: "Import successful",
        description: `Successfully imported ${result.count} leads.`,
      });

      onSuccess();
      handleClose();
    } catch (error) {
      console.error("Error importing CSV:", error);
      toast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Failed to import leads",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setLeadName("");
    setParsedData([]);
    setColumns([]);
    setErrors([]);
    setIsValid(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
    onClose();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      setFile(droppedFile);
      parseCSV(droppedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-xl font-semibold">Import Leads from CSV</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Lead Name Input */}
          <div className="space-y-2">
            <Label htmlFor="leadName">Lead List Name</Label>
            <Input
              id="leadName"
              placeholder="Enter a name for this lead list"
              value={leadName}
              onChange={(e) => setLeadName(e.target.value)}
            />
          </div>

          {/* File Upload Area */}
          <div className="space-y-4">
            <Label>Upload CSV File</Label>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                file ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-gray-400"
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
              />
              
              {!file ? (
                <div className="space-y-4">
                  <Upload className="mx-auto h-12 w-12 text-gray-400" />
                  <div>
                    <p className="text-lg font-medium text-gray-900">
                      Drop your CSV file here, or click to browse
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Supports CSV files with lead data
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose File
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <FileText className="mx-auto h-12 w-12 text-green-500" />
                  <div>
                    <p className="text-lg font-medium text-gray-900">
                      {file.name}
                    </p>
                    <p className="text-sm text-gray-500">
                      {parsedData.length} leads found
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose Different File
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* CSV Format Info */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Expected CSV Format</h4>
            <p className="text-sm text-blue-700 mb-2">
              Your CSV should include these columns (at minimum):
            </p>
            <ul className="text-sm text-blue-700 space-y-1">
              <li>• <strong>name</strong> - Display name of the user</li>
              <li>• <strong>username</strong> - Twitter handle (without @)</li>
              <li>• <strong>id</strong> - Twitter user ID (optional, will be fetched if missing)</li>
              <li>• <strong>bio</strong> - User bio/description (optional)</li>
              <li>• <strong>followers</strong> - Follower count (optional)</li>
              <li>• <strong>following</strong> - Following count (optional)</li>
            </ul>
          </div>

          {/* Validation Results */}
          {errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertCircle className="h-4 w-4 text-red-500" />
                <h4 className="font-medium text-red-900">Validation Errors</h4>
              </div>
              <ul className="text-sm text-red-700 space-y-1">
                {errors.slice(0, 5).map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
                {errors.length > 5 && (
                  <li>• ... and {errors.length - 5} more errors</li>
                )}
              </ul>
            </div>
          )}

          {/* Success Preview */}
          {isValid && parsedData.length > 0 && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <h4 className="font-medium text-green-900">Ready to Import</h4>
              </div>
              <p className="text-sm text-green-700">
                {parsedData.length} leads will be imported. Preview of first 3 leads:
              </p>
              <div className="mt-2 space-y-1">
                {parsedData.slice(0, 3).map((lead, index) => (
                  <div key={index} className="text-sm text-green-700">
                    • {lead.name} (@{lead.username})
                  </div>
                ))}
                {parsedData.length > 3 && (
                  <div className="text-sm text-green-600">
                    ... and {parsedData.length - 3} more
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              onClick={handleUpload}
              disabled={!isValid || isLoading || !leadName.trim()}
            >
              {isLoading ? "Importing..." : `Import ${parsedData.length} Leads`}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 