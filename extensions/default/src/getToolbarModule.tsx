import { utils } from '@ohif/ui-next';

import ToolbarLayoutSelectorWithServices from './Toolbar/ToolbarLayoutSelector';

// legacy
import { ProgressDropdownWithService } from './Components/ProgressDropdownWithService';

// new
import ToolButtonListWrapper from './Toolbar/ToolButtonListWrapper';
import ToolRowWrapper from './Toolbar/ToolRowWrapper';
import { ToolBoxButtonGroupWrapper, ToolBoxButtonWrapper } from './Toolbar/ToolBoxWrapper';
import { ToolButtonWrapper } from './Toolbar/ToolButtonWrapper';
import LesionChipWrapper from './Toolbar/LesionChipWrapper';
import FindingMicWrapper from './Toolbar/FindingMicWrapper';
import { Toolbar } from './Toolbar';

export default function getToolbarModule({ commandsManager, servicesManager }: withAppTypes) {
  const { cineService } = servicesManager.services;
  return [
    // new
    {
      name: 'ohif.toolButton',
      defaultComponent: ToolButtonWrapper,
    },
    {
      name: 'ohif.toolButtonList',
      defaultComponent: ToolButtonListWrapper,
    },
    {
      name: 'ohif.row',
      defaultComponent: ToolRowWrapper,
    },
    {
      name: 'ohif.toolBoxButtonGroup',
      defaultComponent: ToolBoxButtonGroupWrapper,
    },
    {
      name: 'ohif.toolBoxButton',
      defaultComponent: ToolBoxButtonWrapper,
    },
    // others
    {
      name: 'ohif.layoutSelector',
      defaultComponent: props =>
        ToolbarLayoutSelectorWithServices({ ...props, commandsManager, servicesManager }),
    },
    {
      name: 'ohif.progressDropdown',
      defaultComponent: ProgressDropdownWithService,
    },
    // CreateReport#26: finding selector shown next to the R button. Takes
    // servicesManager so it can follow the active viewport's study.
    {
      name: 'cr.lesionChip',
      defaultComponent: props => LesionChipWrapper({ ...props, servicesManager }),
    },
    // CreateReport#183: the mic right of the chip — dictates a note for the
    // finding the chip shows.
    {
      name: 'cr.findingMic',
      defaultComponent: props => FindingMicWrapper(props),
    },
    {
      name: 'ohif.Toolbar',
      defaultComponent: Toolbar,
    },
    {
      name: 'evaluate.cine',
      evaluate: () => {
        const isToggled = cineService.getState().isCineEnabled;
        return {
          className: utils.getToggledClassName(isToggled),
        };
      },
    },
  ];
}
