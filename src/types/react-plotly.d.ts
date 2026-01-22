declare module 'react-plotly.js/factory' {
  import * as Plotly from 'plotly.js';
  import * as React from 'react';

  interface PlotParams {
    data: Plotly.Data[];
    layout?: Partial<Plotly.Layout>;
    config?: Partial<Plotly.Config>;
    frames?: Plotly.Frame[];
    style?: React.CSSProperties;
    className?: string;
    useResizeHandler?: boolean;
    debug?: boolean;
    onInitialized?: (figure: Plotly.Figure, graphDiv: HTMLElement) => void;
    onUpdate?: (figure: Plotly.Figure, graphDiv: HTMLElement) => void;
    onPurge?: (figure: Plotly.Figure, graphDiv: HTMLElement) => void;
    onError?: (err: Error) => void;
    divId?: string;
    onHover?: (event: Plotly.PlotHoverEvent) => void;
    onUnhover?: (event: Plotly.PlotMouseEvent) => void;
    onClick?: (event: Plotly.PlotMouseEvent) => void;
    onSelected?: (event: Plotly.PlotSelectionEvent) => void;
    onDeselect?: () => void;
    onDoubleClick?: () => void;
    onRelayout?: (event: Plotly.PlotRelayoutEvent) => void;
    onRestyle?: (data: Plotly.PlotRestyleEvent) => void;
    onRedraw?: () => void;
    onClickAnnotation?: (event: Plotly.ClickAnnotationEvent) => void;
  }

  function createPlotlyComponent(plotly: typeof Plotly): React.ComponentType<PlotParams>;
  
  export = createPlotlyComponent;
}

declare module 'plotly.js-dist-min' {
  import * as Plotly from 'plotly.js';
  export = Plotly;
}
