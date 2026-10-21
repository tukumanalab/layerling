"use client";

import { Pin } from "lucide-react";
import type { CSSProperties } from "react";
import { KEPT_COLOR_LIMIT } from "@/lib/recentColors";
import { t } from "@/lib/i18n";

/**
 * The two rows under the colour palette: the colours someone keeps for good, with the pin that keeps or lets
 * go of the colour chosen now, and the colours used recently (#507). A kept colour is left out of the recent
 * row, so none shows twice. The pin is for colours of one's own: those of the palette are always there.
 */
export function ColorKeepRows({
  recent,
  kept,
  current,
  palette,
  disabled,
  isSelected,
  onPick,
  onToggleKeep,
}: {
  recent: readonly string[];
  kept: readonly string[];
  /** The colour chosen now, or null when there is none to keep (several colours, a hole). */
  current: string | null;
  palette: readonly string[];
  disabled: boolean;
  isSelected: (color: string) => boolean;
  onPick: (color: string) => void;
  onToggleKeep: (color: string) => void;
}) {
  const shownRecent = recent.filter((color) => !kept.includes(color));
  const chosen = current?.toLowerCase() ?? null;
  const chosenKept = chosen !== null && kept.includes(chosen);
  const full = kept.length >= KEPT_COLOR_LIMIT;
  const canPin = chosen !== null && (chosenKept || !palette.some((entry) => entry.toLowerCase() === chosen));
  const swatches = (colors: readonly string[]) => (
    <div className="color-grid">
      {colors.map((color) => (
        <button
          key={color}
          className={isSelected(color) ? "selected" : ""}
          type="button"
          style={{ "--shape-swatch": color } as CSSProperties}
          title={color.toUpperCase()}
          aria-label={t("aria.setColor", { color })}
          disabled={disabled}
          onClick={() => onPick(color)}
        />
      ))}
    </div>
  );
  return (
    <>
      {kept.length > 0 || canPin ? (
        <div className="color-recent color-kept">
          <span className="color-recent-label color-kept-head">
            <span>{t("inspector.keptColors")}</span>
            {canPin && chosen ? (
              <button
                type="button"
                className="color-keep-button"
                aria-pressed={chosenKept}
                title={t(chosenKept ? "inspector.unkeepColor" : full ? "inspector.keptFull" : "inspector.keepColor")}
                aria-label={t(chosenKept ? "inspector.unkeepColor" : "inspector.keepColor")}
                disabled={disabled || (full && !chosenKept)}
                onClick={() => onToggleKeep(chosen)}
              >
                <Pin size={13} />
              </button>
            ) : null}
          </span>
          {kept.length > 0 ? swatches(kept) : null}
        </div>
      ) : null}
      {shownRecent.length > 0 ? (
        <div className="color-recent">
          <span className="color-recent-label">{t("inspector.recentColors")}</span>
          {swatches(shownRecent)}
        </div>
      ) : null}
    </>
  );
}
