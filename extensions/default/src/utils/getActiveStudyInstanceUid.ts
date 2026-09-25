/**
 * The StudyInstanceUID currently shown in the active viewport.
 *
 * The lesion chip (CreateReport#26) uses this to keep its session pointed at
 * what is on screen. Reading it here, rather than waiting for the next capture
 * to report it, is what lets the radiologist pick a lesion *before* pressing R
 * without the selection being thrown away when the study finally becomes known.
 *
 * Never throws: an unknown study costs the chip its reset, not the viewer.
 */
export function getActiveStudyInstanceUid(
  servicesManager: AppTypes.ServicesManager
): string | null {
  try {
    const { viewportGridService, displaySetService } = servicesManager.services;

    const { activeViewportId, viewports } = viewportGridService.getState();
    const displaySetInstanceUID = viewports.get(activeViewportId)?.displaySetInstanceUIDs?.[0];
    if (!displaySetInstanceUID) {
      return null;
    }

    return displaySetService.getDisplaySetByUID(displaySetInstanceUID)?.StudyInstanceUID ?? null;
  } catch {
    return null;
  }
}
