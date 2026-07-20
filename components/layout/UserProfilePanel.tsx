"use client";

import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { Role } from "@prisma/client";
import { getMyProfile, updateProfileImage } from "@/actions/profile";
import { formatDate } from "@/lib/utils";

interface Props {
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  onClose: () => void;
}

export default function UserProfilePanel({ firstName, lastName, email, role, onClose }: Props) {
  const [image, setImage] = useState<string | null>(null);
  const [createdAt, setCreatedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    getMyProfile().then(({ image, createdAt }) => {
      setImage(image);
      setCreatedAt(new Date(createdAt));
      setLoading(false);
    });
  }, []);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      setUploadError("L'immagine supera il limite di 10 MB.");
      return;
    }

    setUploading(true);
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result as string;
      try {
        await updateProfileImage(dataUrl);
        setImage(dataUrl);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : "Errore durante il caricamento.";
        setUploadError(message);
      } finally {
        setUploading(false);
      }
    };
    reader.readAsDataURL(file);
  }

  const initial = firstName.charAt(0).toUpperCase();
  const roleLabel = role === "ADMIN" ? "Amministratore" : "Dipendente";

  return (
    <>
      {/* Transparent overlay — closes panel on outside click */}
      <div className="fixed inset-0 z-40" onClick={onClose} aria-hidden="true" />

      {/* Panel */}
      <div className="fixed top-14 right-2 z-50 w-[calc(100vw-1rem)] sm:right-4 sm:w-80 bg-card border border-border rounded-2xl shadow-2xl max-h-[calc(100vh-4rem)] overflow-y-auto">
        <div className="p-5 space-y-4">

          {/* Avatar + upload */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center overflow-hidden">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="Foto profilo" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-2xl font-semibold text-primary">{initial}</span>
                )}
              </div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center shadow hover:bg-primary/90 disabled:opacity-50 transition-colors"
                aria-label="Cambia foto profilo"
              >
                {uploading ? (
                  <span className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Camera className="w-3 h-3" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/svg+xml"
                className="hidden"
                onChange={handleFileChange}
              />
            </div>
          </div>

          {uploadError && (
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive text-center">
              {uploadError}
            </div>
          )}

          {/* User info */}
          <div className="space-y-3 pt-1">
            <InfoRow label="Nome" value={firstName} />
            <InfoRow label="Cognome" value={lastName} />
            <InfoRow label="Email" value={email} />
            <InfoRow label="Tipo account" value={roleLabel} />
            {loading ? (
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Membro dal</span>
                <div className="h-4 w-24 bg-secondary animate-pulse rounded" />
              </div>
            ) : createdAt ? (
              <InfoRow label="Membro dal" value={formatDate(createdAt)} />
            ) : null}
          </div>
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground break-all">{value}</span>
    </div>
  );
}
