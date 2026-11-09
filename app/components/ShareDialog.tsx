"use client";

import { useEffect, useState } from "react";
import { Copy, Download, ImageIcon, Loader2, Share2 } from "lucide-react";
import { drawResultCard, type ResultCard } from "@/lib/shareCard";
import Modal from "./Modal";
import Notice from "./Notice";

/**
 * "Share result": draws the result as a picture, shows it, and offers the
 * phone's share sheet (where it can share files), a download, and copying
 * the image.
 */
export default function ShareDialog({ open, onClose, card, text }: {
  open: boolean;
  onClose: () => void;
  card: ResultCard;
  /** Caption sent along with the image. */
  text: string;
}) {
  const [image, setImage] = useState<{ blob: Blob; url: string } | null>(null);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");

  useEffect(() => {
    if (!open) return;
    let alive = true;
    let url = "";
    drawResultCard(card)
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setImage({ blob, url });
      })
      .catch(() => alive && setError("Couldn't draw the picture. Try again."));
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  // The card doesn't change while the dialog is open.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const file = image ? new File([image.blob], "qrio-result.png", { type: "image/png" }) : null;
  const canShareFile = !!file && typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [file] });
  const canCopy = typeof window !== "undefined" && "ClipboardItem" in window;

  function flash(message: string) {
    setDone(message);
    window.setTimeout(() => setDone(""), 2200);
  }

  async function share() {
    if (!file) return;
    try {
      await navigator.share({ files: [file], text });
    } catch { /* closed the share sheet */ }
  }

  async function copy() {
    if (!image) return;
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": image.blob })]);
      flash("Copied");
    } catch {
      setError("This browser won't copy images. Use Download instead.");
    }
  }

  function close() {
    setImage(null);
    setError("");
    setDone("");
    onClose();
  }

  return (
    <Modal open={open} onClose={close} title="Share your result" subtitle="A picture of your marked paper." icon={<ImageIcon size={20} />}>
      <div className="mx-auto w-full max-w-[22rem] aspect-[4/5] rounded-xl border-2 border-ink overflow-clip bg-card-soft flex items-center justify-center">
        {image ? (
          // A generated blob: next/image can't optimise it, and doesn't need to.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.url} alt="Your result, drawn as a marked paper" className="w-full h-full object-contain" />
        ) : (
          <Loader2 size={28} className="animate-spin text-ink-muted" aria-label="Drawing your picture" />
        )}
      </div>
      <Notice className="mt-3">{error}</Notice>
      <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {canShareFile && (
          <button onClick={share} className="sketch-btn-accent gap-2 h-12 text-sm focus-ring">
            <Share2 size={16} /> Share
          </button>
        )}
        <a
          href={image?.url}
          download="qrio-result.png"
          aria-disabled={!image}
          className={`${canShareFile ? "sketch-btn-light" : "sketch-btn-accent"} gap-2 h-12 text-sm focus-ring ${image ? "" : "pointer-events-none opacity-50"}`}
        >
          <Download size={16} /> Download
        </a>
        {canCopy && (
          <button onClick={copy} disabled={!image} className="sketch-btn-light gap-2 h-12 text-sm focus-ring" aria-live="polite">
            <Copy size={16} /> {done || "Copy image"}
          </button>
        )}
      </div>
    </Modal>
  );
}
