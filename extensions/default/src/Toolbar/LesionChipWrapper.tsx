import React, { useCallback, useEffect } from 'react';
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
import { getActiveStudyInstanceUid } from '../utils/getActiveStudyInstanceUid';
import { isCreateReportConfigured } from '../utils/isCreateReportConfigured';

/**
 * The lesion selector that sits next to the R button (CreateReport#26).
 *
 * R captures the viewport and files it under whatever this chip has active, so
 * several views of one lesion cost no interaction here at all — the chip is
 * only touched when the lesion changes.
 *
 * Opening a study starts on Overview: the first capture is usually a scout or
 * whole-study view rather than a lesion.
 *
 * The chip also owns the session boundary. It follows the active viewport, so
 * the store knows which study is on screen from the moment one is displayed
 * rather than from the first press of R — otherwise a lesion picked before that
 * first capture is thrown away when the study finally becomes known.
 */

const imageCountLabel = (finding: Finding): string | null => {
  if (finding.imageCount === 0) {
    return null;
  }
  return finding.imageCount === 1 ? '1 image' : `${finding.imageCount} images`;
};

export default function LesionChipWrapper({
  disabled,
  servicesManager,
}: {
  disabled?: boolean;
  servicesManager?: AppTypes.ServicesManager;
}) {
  const findings = useCreateReportFindingsStore(state => state.findings);
  const activeFindingId = useCreateReportFindingsStore(state => state.activeFindingId);
  const createLesion = useCreateReportFindingsStore(state => state.createLesion);
  const ensureOverview = useCreateReportFindingsStore(state => state.ensureOverview);
  const setActiveFinding = useCreateReportFindingsStore(state => state.setActiveFinding);
  const startStudy = useCreateReportFindingsStore(state => state.startStudy);

  useEffect(() => {
    if (!servicesManager) {
      return;
    }
    const { viewportGridService } = servicesManager.services;

    const syncStudy = () => {
      const uid = getActiveStudyInstanceUid(servicesManager);
      if (uid) {
        startStudy(uid);
      }
    };

    syncStudy();
    const subscriptions = [
      viewportGridService.EVENTS.VIEWPORTS_READY,
      viewportGridService.EVENTS.ACTIVE_VIEWPORT_ID_CHANGED,
      viewportGridService.EVENTS.GRID_STATE_CHANGED,
    ].map(event => viewportGridService.subscribe(event, syncStudy));

    return () => subscriptions.forEach(subscription => subscription.unsubscribe());
  }, [servicesManager, startStudy]);

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

  // Deployments without a `createReport` block cannot send anywhere — R answers
  // "CreateReport base URL is not configured". Offering to name the lesion for
  // that capture would be a promise the viewer cannot keep.
  if (!isCreateReportConfigured()) {
    return null;
  }

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
