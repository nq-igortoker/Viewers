import React, { useCallback } from 'react';
import {
  Button,
  Icons,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuSeparator,
} from '@ohif/ui-next';

import {
  useCreateReportFindingsStore,
  findingLabel,
  type Finding,
} from '../stores/useCreateReportFindingsStore';

/**
 * The lesion selector that sits next to the R button (CreateReport#26).
 *
 * R captures the viewport and files it under whatever this chip has active, so
 * several views of one lesion cost no interaction here at all — the chip is
 * only touched when the lesion changes.
 *
 * Opening a study starts on Overview: the first capture is usually a scout or
 * whole-study view rather than a lesion.
 */

const imageCountLabel = (finding: Finding): string | null => {
  if (finding.imageCount === 0) {
    return null;
  }
  return finding.imageCount === 1 ? '1 image' : `${finding.imageCount} images`;
};

export default function LesionChipWrapper({ disabled }: { disabled?: boolean }) {
  const findings = useCreateReportFindingsStore(state => state.findings);
  const activeFindingId = useCreateReportFindingsStore(state => state.activeFindingId);
  const createLesion = useCreateReportFindingsStore(state => state.createLesion);
  const ensureOverview = useCreateReportFindingsStore(state => state.ensureOverview);
  const setActiveFinding = useCreateReportFindingsStore(state => state.setActiveFinding);

  const active = findings.find(f => f.id === activeFindingId);
  const lesions = findings.filter(f => f.kind === 'lesion');
  const overview = findings.find(f => f.kind === 'overview');

  const onSelectOverview = useCallback(() => {
    setActiveFinding(ensureOverview().id);
  }, [ensureOverview, setActiveFinding]);

  const onNewLesion = useCallback(() => {
    createLesion();
  }, [createLesion]);

  const triggerLabel = active ? findingLabel(active) : 'Overview';

  return (
    // h-10 matches the R button's box so the chip sits on the same baseline
    <div className="flex h-10 items-center">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            disabled={disabled}
            aria-label={`Active finding: ${triggerLabel}. Change or create a lesion.`}
          >
            <span>{triggerLabel}</span>
            <Icons.ByName name="chevron-down" />
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="start">
          {lesions.map(finding => {
            const count = imageCountLabel(finding);
            return (
              <DropdownMenuCheckboxItem
                key={finding.id}
                checked={finding.id === activeFindingId}
                onSelect={() => setActiveFinding(finding.id)}
              >
                <span>{findingLabel(finding)}</span>
                {count ? <span className="ml-2 opacity-60">{count}</span> : null}
              </DropdownMenuCheckboxItem>
            );
          })}

          <DropdownMenuCheckboxItem
            checked={!!overview && overview.id === activeFindingId}
            onSelect={onSelectOverview}
          >
            <span>Overview</span>
            {overview && imageCountLabel(overview) ? (
              <span className="ml-2 opacity-60">{imageCountLabel(overview)}</span>
            ) : null}
          </DropdownMenuCheckboxItem>

          <DropdownMenuSeparator />

          <DropdownMenuItem onSelect={onNewLesion}>+ New lesion</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

export { LesionChipWrapper };
