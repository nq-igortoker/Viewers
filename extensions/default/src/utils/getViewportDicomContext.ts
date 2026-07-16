/**
 * Resolves the DICOM context of the image currently shown in a viewport:
 * Study/Series/SOP UIDs plus a curated metadata excerpt. Sent alongside the
 * screenshot in the CR_ADD_IMAGE v2 handoff (CreateReport#97) so CreateReport
 * can attribute the image to the right worklist case and, later, reuse
 * patient/technique data.
 *
 * Deliberately a whitelist, not a full header dump: the excerpt defines
 * exactly which (patient-identifying) data crosses the system boundary.
 */

export interface DicomRef {
  studyInstanceUid: string;
  seriesInstanceUid?: string;
  sopInstanceUid?: string;
  frameNumber?: number;
}

export interface DicomMetaExcerpt {
  patientName?: string;
  patientBirthDate?: string;
  patientSex?: string;
  modality?: string;
  studyDate?: string;
  studyDescription?: string;
  seriesDescription?: string;
  manufacturer?: string;
  manufacturerModelName?: string;
  kvp?: string;
  sliceThickness?: string;
}

export interface ViewportDicomContext {
  dicomRef: DicomRef;
  meta: DicomMetaExcerpt;
}

/** DICOM PN values arrive as 'Family^Given' strings or { Alphabetic } objects. */
const formatPersonName = (value: unknown): string | undefined => {
  if (!value) {
    return undefined;
  }
  const raw =
    typeof value === 'string' ? value : (value as { Alphabetic?: string }).Alphabetic;
  if (typeof raw !== 'string' || !raw) {
    return undefined;
  }
  const [family, given] = raw.split('^');
  return given ? `${given} ${family}` : family;
};

const asString = (value: unknown): string | undefined => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  return String(value);
};

/**
 * Best-effort resolution of the viewport's current DICOM context.
 *
 * Study/Series level always resolves for image display sets. The exact
 * instance (SOP UID, frame) resolves for stack viewports via
 * getCurrentImageId(); volume/3D viewports fall back to the display set's
 * first instance — sufficient for case attribution, which works on the
 * StudyInstanceUID.
 *
 * Never throws: handoff must degrade to a v1-style send rather than block
 * the screenshot.
 */
export function getViewportDicomContext(
  servicesManager: AppTypes.ServicesManager,
  viewportId: string
): ViewportDicomContext | null {
  try {
    const { viewportGridService, displaySetService, cornerstoneViewportService } =
      servicesManager.services;

    const { viewports } = viewportGridService.getState();
    const displaySetInstanceUID = viewports.get(viewportId)?.displaySetInstanceUIDs?.[0];
    if (!displaySetInstanceUID) {
      return null;
    }

    const displaySet = displaySetService.getDisplaySetByUID(displaySetInstanceUID);
    if (!displaySet?.StudyInstanceUID) {
      return null;
    }

    const instances: any[] = Array.isArray(displaySet.instances) ? displaySet.instances : [];
    let instance = instances[0];
    let sopInstanceUid: string | undefined;
    let frameNumber: number | undefined;

    try {
      const csViewport = cornerstoneViewportService?.getCornerstoneViewport?.(viewportId);
      const currentImageId: string | undefined = csViewport?.getCurrentImageId?.();
      if (currentImageId && instances.length) {
        const frameMatch = currentImageId.match(/\/frames\/(\d+)$/);
        const baseImageId = frameMatch
          ? currentImageId.replace(/\/frames\/\d+$/, '')
          : currentImageId;
        const matched = instances.find(
          inst =>
            inst.imageId === currentImageId ||
            (typeof inst.imageId === 'string' &&
              inst.imageId.replace(/\/frames\/\d+$/, '') === baseImageId)
        );
        if (matched) {
          instance = matched;
          sopInstanceUid = asString(matched.SOPInstanceUID);
          if (frameMatch) {
            frameNumber = parseInt(frameMatch[1], 10);
          }
        }
      }
    } catch (error) {
      // Volume/3D viewports have no single current image — series level is enough
      console.debug('No exact instance for viewport, using series-level context:', error);
    }

    const meta: DicomMetaExcerpt = {
      patientName: formatPersonName(instance?.PatientName),
      patientBirthDate: asString(instance?.PatientBirthDate),
      patientSex: asString(instance?.PatientSex),
      modality: asString(instance?.Modality ?? displaySet.Modality),
      studyDate: asString(instance?.StudyDate),
      studyDescription: asString(instance?.StudyDescription ?? displaySet.StudyDescription),
      seriesDescription: asString(
        instance?.SeriesDescription ?? displaySet.SeriesDescription
      ),
      manufacturer: asString(instance?.Manufacturer),
      manufacturerModelName: asString(instance?.ManufacturerModelName),
      kvp: asString(instance?.KVP),
      sliceThickness: asString(instance?.SliceThickness),
    };
    // Drop empty entries so the message stays minimal
    Object.keys(meta).forEach(key => {
      if (meta[key] === undefined) {
        delete meta[key];
      }
    });

    return {
      dicomRef: {
        studyInstanceUid: String(displaySet.StudyInstanceUID),
        seriesInstanceUid: asString(displaySet.SeriesInstanceUID),
        sopInstanceUid,
        frameNumber,
      },
      meta,
    };
  } catch (error) {
    console.warn('getViewportDicomContext failed — sending image without DICOM context:', error);
    return null;
  }
}

export default getViewportDicomContext;
