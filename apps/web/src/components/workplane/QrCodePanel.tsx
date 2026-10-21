"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { GuideHelpLink } from "@/components/GuideHelpLink";
import { MovableToolPanel } from "@/components/workplane/MovableToolPanel";
import { t } from "@/lib/i18n";
import { localizedError } from "@/lib/userErrors";
import { parseMeasurementInput } from "@/lib/measurementUnits";
import {
  DEFAULT_QR_CODE_HEIGHT,
  DEFAULT_QR_PLATE_THICKNESS,
  DEFAULT_QR_RELIEF,
  DEFAULT_QR_WIDTH,
  MAX_QR_HEIGHT,
  MAX_QR_WIDTH,
  MIN_QR_HEIGHT,
  MIN_QR_WIDTH,
  QR_BYTE_CAPACITY,
  QR_ERROR_CORRECTIONS,
  QR_QUIET_MODULES,
  QR_STYLES,
  qrByteLength,
  qrMatrix,
  qrModuleSize,
  qrModuleTooSmall,
  qrPreviewSvg,
  qrTextFits,
  type QrCodeSettings,
  type QrErrorCorrection,
  type QrStyle,
} from "@/lib/qrCode";
import { useLanguage } from "@/lib/useLanguage";

/** How much of the code each level can lose and still be read, as the standard gives it. */
const RECOVERY: Record<QrErrorCorrection, number> = { L: 7, M: 15, Q: 25, H: 30 };

const errorText = (reason: unknown) => (reason instanceof Error ? localizedError(reason.message) : String(reason));
const formatMm = (value: number) => (Math.round(value * 100) / 100).toLocaleString(undefined, { maximumFractionDigits: 2 });

/**
 * The QR code window (#553): the shape library's QR code opens it. Type a text or an address, choose
 * the error correction, the size, the quiet zone and whether it stands on a plate; the preview shows
 * the code as it will be built, and OK puts it on the plate. Enter is OK, Shift+Enter a new line,
 * Escape closes the window.
 */
export function QrCodePanel({ onClose, onCreate }: {
  onClose: () => void;
  onCreate: (settings: QrCodeSettings, width: number) => Promise<void>;
}) {
  useLanguage();
  const textRef = useRef<HTMLTextAreaElement>(null);
  const [text, setText] = useState("");
  const [errorCorrection, setErrorCorrection] = useState<QrErrorCorrection>("M");
  const [style, setStyle] = useState<QrStyle>("code");
  const [quietZone, setQuietZone] = useState(true);
  const [sizeBy, setSizeBy] = useState<"width" | "module">("width");
  const [size, setSize] = useState(String(DEFAULT_QR_WIDTH));
  const [codeHeight, setCodeHeight] = useState(String(DEFAULT_QR_CODE_HEIGHT));
  const [plateThickness, setPlateThickness] = useState(String(DEFAULT_QR_PLATE_THICKNESS));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    textRef.current?.focus();
  }, []);

  const bytes = qrByteLength(text);
  const capacity = QR_BYTE_CAPACITY[errorCorrection];
  const fits = qrTextFits(text, errorCorrection);
  const matrix = useMemo(() => {
    if (!text || !fits) return null;
    try {
      return qrMatrix(text, errorCorrection);
    } catch {
      return null;
    }
  }, [errorCorrection, fits, text]);
  const onPlate = style !== "code";
  const across = matrix ? matrix.length + (onPlate && quietZone ? 2 * QR_QUIET_MODULES : 0) : 0;
  const sizeValue = parseMeasurementInput(size);
  const width = sizeBy === "width" ? sizeValue : sizeValue * across;
  const widthOk = Number.isFinite(width) && width >= MIN_QR_WIDTH && width <= MAX_QR_WIDTH;
  const moduleSize = matrix && widthOk ? qrModuleSize(matrix.length, width, style, quietZone) : null;
  const heightValue = parseMeasurementInput(codeHeight);
  const heightOk = Number.isFinite(heightValue) && heightValue >= MIN_QR_HEIGHT && heightValue <= MAX_QR_HEIGHT;
  const plateValue = parseMeasurementInput(plateThickness);
  const plateOk = !onPlate || (Number.isFinite(plateValue) && plateValue >= MIN_QR_HEIGHT && plateValue <= MAX_QR_HEIGHT);
  // An engraving leaves at least a thin floor under it.
  const depthOk = style !== "engraved" || (heightOk && plateOk && heightValue <= plateValue - 0.2);
  const preview = useMemo(() => (matrix ? `data:image/svg+xml;charset=utf-8,${encodeURIComponent(qrPreviewSvg(matrix, quietZone))}` : null), [matrix, quietZone]);
  const ready = Boolean(matrix) && widthOk && heightOk && plateOk && depthOk && !busy;

  const chooseStyle = (next: QrStyle) => {
    if (next === style) return;
    // The code alone stands 4 mm high; on a plate it is a 1 mm relief. A height typed in stays.
    const wasDefault = parseMeasurementInput(codeHeight) === (style === "code" ? DEFAULT_QR_CODE_HEIGHT : DEFAULT_QR_RELIEF);
    if (wasDefault) setCodeHeight(String(next === "code" ? DEFAULT_QR_CODE_HEIGHT : DEFAULT_QR_RELIEF));
    setStyle(next);
  };
  const chooseSizeBy = (next: "width" | "module") => {
    if (next === sizeBy) return;
    // The number turns into the other measure, so the code keeps its size.
    if (next === "module" && moduleSize) setSize(formatMm(moduleSize).replace(",", "."));
    if (next === "width" && widthOk) setSize(String(Math.round(width * 100) / 100));
    setSizeBy(next);
  };
  const create = async () => {
    if (!ready) return;
    setBusy(true);
    setError("");
    try {
      await onCreate({
        text,
        errorCorrection,
        quietZone,
        style,
        codeHeight: heightValue,
        plateThickness: onPlate ? plateValue : DEFAULT_QR_PLATE_THICKNESS,
      }, width);
    } catch (reason) {
      setError(errorText(reason));
    } finally {
      setBusy(false);
    }
  };
  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    // Enter is OK; in the text Shift+Enter starts a new line.
    if (event.key === "Enter" && !event.shiftKey && !(event.nativeEvent as KeyboardEvent).isComposing) {
      const target = event.target as HTMLElement;
      if (target.tagName === "BUTTON") return;
      event.preventDefault();
      void create();
    }
  };
  const heightLabel = style === "code" ? t("qrCode.height") : style === "raised" ? t("qrCode.heightRaised") : t("qrCode.heightEngraved");

  return (
    <MovableToolPanel className="top-action-panel import-action-panel icon-tag-panel qr-code-panel" ariaLabel={t("qrCode.title")}>
      {(handleProps) => (<>
      <header className="movable" title={t("panel.moveHint")} {...handleProps}>
        <div className="top-action-heading">
          <strong>{t("qrCode.title")}</strong>
        </div>
        <div className="panel-header-actions">
          <GuideHelpLink chapter="text" section="qrCode" />
          <button type="button" aria-label={t("panel.close", { title: t("qrCode.title") })} onClick={onClose}>
            <X size={18} />
          </button>
        </div>
      </header>
      <div className="top-action-body" onKeyDown={onKeyDown}>
        <p>{t("qrCode.hint")}</p>
        <label className="qr-code-text">
          <span>{t("qrCode.text")}</span>
          <textarea
            ref={textRef}
            rows={3}
            value={text}
            disabled={busy}
            placeholder="https://"
            aria-invalid={!fits}
            data-testid="qr-code-text"
            onChange={(event) => setText(event.currentTarget.value)}
          />
          <small className={fits ? "" : "qr-code-warning"}>
            {fits ? t("qrCode.count", { used: bytes, max: capacity }) : t("qrCode.tooLong", { used: bytes, max: capacity })}
          </small>
          <small>{t("qrCode.enterHint")}</small>
        </label>
        <div className="qr-code-preview icon-tag-preview" aria-label={t("qrCode.preview")}>
          {preview ? <img src={preview} alt={t("qrCode.preview")} /> : <span className="icon-tag-preview-empty" aria-hidden="true">QR</span>}
        </div>
        <div className="edge-modifier-field shell-openings" role="radiogroup" aria-label={t("qrCode.errorCorrection")}>
          <span title={t("qrCode.errorCorrectionHint")}>{t("qrCode.errorCorrection")}</span>
          <div className="shell-opening-options">
            {QR_ERROR_CORRECTIONS.map((level) => (
              <button key={level} type="button" role="radio" aria-checked={errorCorrection === level} className={errorCorrection === level ? "active" : ""} disabled={busy} title={t("qrCode.recovery", { percent: RECOVERY[level] })} onClick={() => setErrorCorrection(level)}>
                {level}
              </button>
            ))}
          </div>
        </div>
        <div className="edge-modifier-field shell-openings" role="radiogroup" aria-label={t("qrCode.style")}>
          <span title={t("qrCode.styleHint")}>{t("qrCode.style")}</span>
          <div className="shell-opening-options">
            {QR_STYLES.map((option) => (
              <button key={option} type="button" role="radio" aria-checked={style === option} className={style === option ? "active" : ""} disabled={busy} onClick={() => chooseStyle(option)}>
                {t(`qrCode.style.${option}`)}
              </button>
            ))}
          </div>
        </div>
        <div className="edge-modifier-field shell-openings" role="radiogroup" aria-label={t("qrCode.sizeBy")}>
          <span>{t("qrCode.sizeBy")}</span>
          <div className="shell-opening-options">
            {(["width", "module"] as const).map((option) => (
              <button key={option} type="button" role="radio" aria-checked={sizeBy === option} className={sizeBy === option ? "active" : ""} disabled={busy} onClick={() => chooseSizeBy(option)}>
                {t(`qrCode.sizeBy.${option}`)}
              </button>
            ))}
          </div>
        </div>
        <label className="icon-tag-width">
          <span>{sizeBy === "width" ? t("qrCode.width") : t("qrCode.moduleSize")}</span>
          <input type="text" inputMode="decimal" value={size} disabled={busy} aria-invalid={!widthOk && Boolean(matrix)} onChange={(event) => setSize(event.currentTarget.value)} />
          <small>
            {moduleSize !== null
              ? sizeBy === "width" ? t("qrCode.moduleInfo", { size: formatMm(moduleSize), count: matrix?.length ?? 0 }) : t("qrCode.widthInfo", { width: formatMm(width), count: matrix?.length ?? 0 })
              : t("qrCode.widthHint", { min: MIN_QR_WIDTH, max: MAX_QR_WIDTH })}
          </small>
          {moduleSize !== null && qrModuleTooSmall(moduleSize) ? <small className="qr-code-warning" role="status">{t("qrCode.moduleSmall")}</small> : null}
        </label>
        <label className="qr-code-check">
          <input type="checkbox" checked={quietZone} disabled={busy || !onPlate} onChange={(event) => setQuietZone(event.currentTarget.checked)} />
          <span>{t("qrCode.quietZone")}</span>
        </label>
        <small className="qr-code-note">{onPlate ? t("qrCode.quietZoneHint") : t("qrCode.quietZoneAlone")}</small>
        <label className="icon-tag-width">
          <span>{heightLabel}</span>
          <input type="text" inputMode="decimal" value={codeHeight} disabled={busy} aria-invalid={!heightOk || !depthOk} onChange={(event) => setCodeHeight(event.currentTarget.value)} />
          {!depthOk && heightOk ? <small className="qr-code-warning">{t("qrCode.tooDeep")}</small> : null}
        </label>
        {onPlate ? (
          <label className="icon-tag-width">
            <span>{t("qrCode.plateThickness")}</span>
            <input type="text" inputMode="decimal" value={plateThickness} disabled={busy} aria-invalid={!plateOk} onChange={(event) => setPlateThickness(event.currentTarget.value)} />
          </label>
        ) : null}
        {error ? <p className="icon-tag-error" role="alert">{error}</p> : null}
        <button className="icon-tag-ok" type="button" disabled={!ready} onClick={() => void create()}>
          {busy ? t("qrCode.building") : t("qrCode.ok")}
        </button>
      </div>
      </>)}
    </MovableToolPanel>
  );
}
