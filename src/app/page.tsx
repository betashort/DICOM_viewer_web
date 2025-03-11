"use client";

import { useState, useRef } from "react";
import { Upload, Download, Edit2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import dicomParser from "dicom-parser";
import * as dcmjs from 'dcmjs';

interface DicomTag {
  tag: string;
  vr: string;
  value: string;
  rawTag: string;
}

export default function Home() {
  const [dicomTags, setDicomTags] = useState<DicomTag[]>([]);
  const [editingTag, setEditingTag] = useState<DicomTag | null>(null);
  const [originalDataSet, setOriginalDataSet] = useState<any>(null);
  const [originalBuffer, setOriginalBuffer] = useState<ArrayBuffer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const arrayBuffer = e.target?.result as ArrayBuffer;
      try {
        setOriginalBuffer(arrayBuffer);
        const byteArray = new Uint8Array(arrayBuffer);
        const dataSet = dicomParser.parseDicom(byteArray);
        setOriginalDataSet(dataSet);
        
        const tags: DicomTag[] = [];
        for (let tag in dataSet.elements) {
          const element = dataSet.elements[tag];
          const vr = element.vr || "UN";
          let value = "";

          if (vr === "UI" || vr === "SH" || vr === "LO" || vr === "ST" || vr === "PN" || vr === "CS" || 
              vr === "DA" || vr === "DS" || vr === "IS") {
            value = dataSet.string(tag) || "";
          } else {
            value = "Binary data";
          }

          tags.push({
            tag: `(${tag.substring(0, 4)},${tag.substring(4)})`,
            vr,
            value,
            rawTag: tag
          });
        }
        setDicomTags(tags);
      } catch (error) {
        console.error("Error parsing DICOM file:", error);
        alert("DICOMファイルの解析中にエラーが発生しました。");
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleEditTag = (tag: DicomTag) => {
    setEditingTag(tag);
  };

  const handleSaveTag = () => {
    if (!editingTag || !originalDataSet) return;

    try {
      const updatedTags = dicomTags.map(tag => {
        if (tag.rawTag === editingTag.rawTag) {
          return editingTag;
        }
        return tag;
      });
      setDicomTags(updatedTags);
      setEditingTag(null);
    } catch (error) {
      console.error("Error saving tag:", error);
      alert("タグの保存中にエラーが発生しました。");
    }
  };

  const handleExport = async () => {
    if (!originalBuffer || !originalDataSet || !dicomTags.length) return;

    try {
      // Create a copy of the original buffer
      const arrayBuffer = originalBuffer.slice(0);
      const byteArray = new Uint8Array(arrayBuffer);
      
      // Create a new dataset from the original buffer
      const dataSet = dicomParser.parseDicom(byteArray);
      
      // Apply modifications
      dicomTags.forEach(tag => {
        if (tag.value !== "Binary data") {
          const element = dataSet.elements[tag.rawTag];
          if (element) {
            const encoder = new TextEncoder();
            const bytes = encoder.encode(tag.value);
            
            // Update the element's data
            element.dataOffset = element.dataOffset;
            element.length = bytes.length;
            byteArray.set(bytes, element.dataOffset);
          }
        }
      });

      // Create and download the file
      const blob = new Blob([byteArray], { type: 'application/dicom' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'modified.dcm';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting DICOM:", error);
      alert("DICOMファイルの出力中にエラーが発生しました。");
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-foreground">DICOM Tag Viewer</h1>
          {dicomTags.length > 0 && (
            <Button onClick={handleExport} className="flex items-center gap-2">
              <Download className="w-4 h-4" />
              エクスポート
            </Button>
          )}
        </div>
        
        <Card className="p-6">
          <div className="flex items-center justify-center w-full">
            <label htmlFor="dicom-upload" className="cursor-pointer">
              <div className="flex flex-col items-center gap-2">
                <Upload className="w-12 h-12 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">DICOMファイルを選択してください</span>
              </div>
              <input
                ref={fileInputRef}
                id="dicom-upload"
                type="file"
                accept=".dcm,.DCM,application/dicom"
                className="hidden"
                onChange={handleFileUpload}
              />
            </label>
          </div>
        </Card>

        {dicomTags.length > 0 && (
          <Card className="p-6">
            <h2 className="text-xl font-semibold mb-4">DICOM Tags</h2>
            <ScrollArea className="h-[600px] rounded-md border">
              <div className="p-4">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="pb-2">Tag</th>
                      <th className="pb-2">VR</th>
                      <th className="pb-2">Value</th>
                      <th className="pb-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dicomTags.map((tag, index) => (
                      <tr key={index} className="border-b last:border-0">
                        <td className="py-2 font-mono">{tag.tag}</td>
                        <td className="py-2">{tag.vr}</td>
                        <td className="py-2 break-all">{tag.value}</td>
                        <td className="py-2">
                          {tag.value !== "Binary data" && (
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEditTag(tag)}
                                >
                                  <Edit2 className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>タグの編集</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4 py-4">
                                  <div>
                                    <label className="text-sm font-medium">
                                      Tag: {tag.tag}
                                    </label>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium">
                                      VR: {tag.vr}
                                    </label>
                                  </div>
                                  <div>
                                    <label className="text-sm font-medium">
                                      Value:
                                    </label>
                                    <Input
                                      value={editingTag?.value || ""}
                                      onChange={(e) =>
                                        setEditingTag(prev => 
                                          prev ? { ...prev, value: e.target.value } : null
                                        )
                                      }
                                      className="mt-1"
                                    />
                                  </div>
                                  <Button
                                    className="w-full mt-4"
                                    onClick={handleSaveTag}
                                  >
                                    <Save className="w-4 h-4 mr-2" />
                                    保存
                                  </Button>
                                </div>
                              </DialogContent>
                            </Dialog>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
          </Card>
        )}
      </div>
    </div>
  );
}