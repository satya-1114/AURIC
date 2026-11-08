import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, ImagePlus, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { analyzePhoto, verifyPhoto, resumePhotoAI } from "@/lib/photo-reading.functions";
import { useQuery } from "@tanstack/react-query";
import { meQuery } from "@/lib/queries";
import {
  needsManualVerification,
  readingBlocks,
  uploadError,
  type Reading,
} from "@/lib/photo-reading";
import { purityField, weightField } from "@/lib/validation";
import { fmtGrams, fmtPurity } from "@/lib/format";

type Props = {
  operation: "issue" | "receipt";
  requestId: string;
  weight: string;
  purity: string;
  onApply: (weight: string | null, purity: string | null) => void;
  onBlocked: (blocked: boolean) => void;
};

export function PhotoReader({ operation, requestId, weight, purity, onApply, onBlocked }: Props) {
  const [open, setOpen] = useState(false);
  const [photo, setPhoto] = useState("");
  const [readings, setReadings] = useState<(Reading & { photo: string })[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [editedWeight, setEditedWeight] = useState("");
  const [editedPurity, setEditedPurity] = useState("");
  const [reason, setReason] = useState("");
  const [checked, setChecked] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const analyze = useServerFn(analyzePhoto);
  const verify = useServerFn(verifyPhoto);
  const resume = useServerFn(resumePhotoAI);
  const me = useQuery(meQuery);
  const current = readings.find((r) => r.id === active);
  const blockers = readings.filter((r) => readingBlocks(r, weight, purity));
  const manual = current ? needsManualVerification(current, editedWeight, editedPurity) : false;

  useEffect(() => {
    onBlocked(blockers.length > 0 || busy);
  }, [blockers.length, busy, onBlocked]);

  async function choose(file?: File) {
    if (!file) return;
    const invalid = uploadError(file.type, file.size);
    if (invalid) {
      setError(invalid);
      return;
    }
    setError("");
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== "string") return;
      setPhoto(reader.result);
      setActive(null);
      setChecked(false);
      setReason("");
      setEditedWeight("");
      setEditedPurity("");
    };
    reader.onerror = () => setError("Could not open this photograph. Select another image.");
    reader.readAsDataURL(file);
  }

  async function analyzeImage() {
    if (!photo || busy) return;
    setBusy(true);
    setError("");
    try {
      const r = await analyze({ data: { dataURL: photo, requestId, operation } });
      setReadings((rows) => [...rows, { ...r, photo }]);
      setActive(r.id);
      setEditedWeight(r.extraction?.gross_weight ?? "");
      setEditedPurity(r.extraction?.purity_percent ?? "");
      setChecked(false);
      setReason("");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Analysis was interrupted. Try again or enter manually.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirm(reject: boolean) {
    if (!current || busy) return;
    if (!reject) {
      if (!checked) {
        setError("Verify the values against the photograph first.");
        return;
      }
      if (!editedWeight && !editedPurity) {
        setError("Enter a readable weight or purity, or reject this photograph.");
        return;
      }
      if (editedWeight && !weightField.safeParse(editedWeight).success) {
        setError("Weight must be positive, with at most 3 decimal places.");
        return;
      }
      if (editedPurity && !purityField.safeParse(editedPurity).success) {
        setError("Purity must be above 0 and at most 100, with at most 2 decimal places.");
        return;
      }
      if (manual && reason.trim().length < 5) {
        setError("Give a reason for the manually verified reading.");
        return;
      }
    }
    setBusy(true);
    setError("");
    try {
      const result = await verify({
        data: { id: current.id, reject, weight: editedWeight, purity: editedPurity, reason },
      });
      setReadings((rows) => rows.map((r) => (r.id === current.id ? { ...r, ...result } : r)));
      if (result.weight) setEditedWeight(Number(result.weight).toFixed(3));
      if (result.purity) setEditedPurity(Number(result.purity).toFixed(2));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify the reading. Try again.");
    } finally {
      setBusy(false);
    }
  }

  function view(r: Reading & { photo: string }) {
    setActive(r.id);
    setPhoto(r.photo);
    setEditedWeight(r.weight ? Number(r.weight).toFixed(3) : (r.extraction?.gross_weight ?? ""));
    setEditedPurity(r.purity ? Number(r.purity).toFixed(2) : (r.extraction?.purity_percent ?? ""));
    setChecked(false);
    setReason("");
    setError("");
    setOpen(true);
  }

  return (
    <div className="space-y-2 sm:col-span-2">
      <Button type="button" variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Camera className="size-4" />
        Read from Photo
      </Button>
      {readings.map((r) => (
        <div
          key={r.id}
          className={`border-l-2 pl-3 text-sm ${readingBlocks(r, weight, purity) ? "border-destructive" : "border-border"}`}
        >
          <p className="font-medium">Photo reading · {r.status}</p>
          <p className="num text-muted-foreground">
            Photo:{" "}
            {r.weight || r.extraction?.gross_weight
              ? fmtGrams(r.weight ?? r.extraction?.gross_weight)
              : "— g"}{" "}
            ·{" "}
            {r.purity || r.extraction?.purity_percent
              ? fmtPurity(r.purity ?? r.extraction?.purity_percent)
              : "—"}
            %
          </p>
          {readingBlocks(r, weight, purity) && (
            <p className="num text-destructive">
              Entered: {weight || "—"} g · {purity || "—"}% · Resolve before recording.
            </p>
          )}
          <Button
            type="button"
            variant="link"
            size="sm"
            className="h-auto px-0"
            onClick={() => view(r)}
          >
            Review photograph
          </Button>
        </div>
      ))}
      <Dialog
        open={open}
        onOpenChange={(v) => {
          if (!busy) setOpen(v);
        }}
      >
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Read from Photo</DialogTitle>
            <DialogDescription>
              Scale display or karat-meter result · JPEG, PNG, WebP · Up to 5 MB
            </DialogDescription>
          </DialogHeader>
          <div className="grid min-w-0 gap-6 md:grid-cols-2">
            <div className="min-w-0 space-y-3">
              <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-md border bg-muted">
                {photo ? (
                  <img
                    src={photo}
                    alt="Original instrument photograph"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <Camera className="size-10 text-muted-foreground" />
                )}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                aria-label="Select instrument photograph"
                disabled={busy}
                onChange={(e) => {
                  void choose(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <input
                ref={cameraInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                capture="environment"
                className="sr-only"
                aria-label="Capture instrument photograph"
                disabled={busy}
                onChange={(e) => {
                  void choose(e.target.files?.[0]);
                  e.target.value = "";
                }}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => fileInput.current?.click()}
                >
                  <ImagePlus className="size-4" />
                  {photo ? "Upload another photograph" : "Choose photograph"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => cameraInput.current?.click()}
                >
                  <Camera className="size-4" />
                  Camera
                </Button>
              </div>
              <Button
                type="button"
                disabled={!photo || busy || !!current}
                onClick={() => void analyzeImage()}
              >
                {busy ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
                {busy ? "Processing reading…" : "Analyze Image"}
              </Button>
            </div>
            <div className="min-w-0 space-y-4" aria-live="polite">
              {current ? (
                <>
                  <p className="font-semibold capitalize">{current.status} reading</p>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt>Displayed value</dt>
                      <dd className="num text-right">
                        {current.extraction?.displayed_value ?? "Unreadable"}{" "}
                        {current.extraction?.unit ?? ""}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Extracted weight</dt>
                      <dd className="num text-right">
                        {current.extraction?.gross_weight ?? "—"} g
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Extracted purity</dt>
                      <dd className="num text-right">
                        {current.extraction?.purity_percent ?? "—"}%
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Karat</dt>
                      <dd className="num">{current.extraction?.karat ?? "—"}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt>Confidence</dt>
                      <dd className="num">
                        {current.extraction
                          ? `${Math.round(current.extraction.confidence * 100)}%`
                          : "—"}{" "}
                        · minimum {Math.round(current.threshold * 100)}%
                      </dd>
                    </div>
                  </dl>
                  {current.error && <p className="text-sm text-destructive">{current.error}</p>}
                  {current.extraction?.warnings.map((w, i) => (
                    <p key={i} className="text-sm text-destructive">
                      {w}
                    </p>
                  ))}
                  <div className="space-y-1">
                    <Label htmlFor="photo-weight">Verified gross weight (g)</Label>
                    <Input
                      id="photo-weight"
                      inputMode="decimal"
                      className="num text-right"
                      value={editedWeight}
                      onChange={(e) => {
                        setEditedWeight(e.target.value);
                        setChecked(false);
                      }}
                      disabled={busy || current.status === "rejected"}
                      placeholder="Unreadable / not present"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="photo-purity">Verified purity (%)</Label>
                    <Input
                      id="photo-purity"
                      inputMode="decimal"
                      className="num text-right"
                      value={editedPurity}
                      onChange={(e) => {
                        setEditedPurity(e.target.value);
                        setChecked(false);
                      }}
                      disabled={busy || current.status === "rejected"}
                      placeholder="Unreadable / not present"
                    />
                  </div>
                  {current.status !== "rejected" && (
                    <>
                      {manual && (
                        <div className="space-y-1">
                          <Label htmlFor="photo-reason">Manual verification reason</Label>
                          <Input
                            id="photo-reason"
                            value={reason}
                            maxLength={500}
                            onChange={(e) => setReason(e.target.value)}
                          />
                        </div>
                      )}
                      <Label className="flex items-start gap-2">
                        <Checkbox
                          checked={checked}
                          onCheckedChange={(v) => setChecked(v === true)}
                        />
                        I have checked these values against the original photograph.
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" disabled={busy} onClick={() => void confirm(false)}>
                          <Check className="size-4" />
                          Confirm reading
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void confirm(true)}
                        >
                          <X className="size-4" />
                          Reject reading
                        </Button>
                      </div>
                    </>
                  )}
                  {current.status === "confirmed" && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={busy || !readings.every((r) => r.status !== "draft")}
                      onClick={() => {
                        onApply(current.weight, current.purity);
                        setOpen(false);
                      }}
                    >
                      Use confirmed values in form
                    </Button>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  {busy ? "Reading the instrument display…" : "Awaiting photograph analysis"}
                </p>
              )}
              {error && (
                <p role="alert" className="break-words text-sm text-destructive">
                  {error}
                </p>
              )}
              {current?.error && me.data?.role === "finance_head" && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={async () => {
                    setBusy(true);
                    try {
                      await resume();
                      setError("AI access resumed. Upload a photograph to start a new analysis.");
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Could not resume AI access.");
                    } finally {
                      setBusy(false);
                    }
                  }}
                >
                  Resume AI after access is restored
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
