(() => {
'use strict';
const RT=window.__ghostPlusRuntime?.module('ui-vi');if(!RT)return;
if(window.__GHOST_PLUS_VI_SAFE__)return;
window.__GHOST_PLUS_VI_SAFE__=true;

// Vietnamese is rendered by each module at its source through the i18n
// service. This stylesheet ONLY keeps longer labels usable on small screens.
// It never masks original English text, changes control IDs, or mutates DOM.
const style=document.createElement('style');
style.id='ghost-plus-vi-safe-style';
style.textContent=`
#gitl9 button,
#ghostplus-gate button,
#ghostplus-watch button{white-space:normal!important;overflow-wrap:anywhere}
#gitl9 .tabs button{min-width:0;line-height:1.3}
#gitl9 .row{flex-wrap:wrap}
#gitl9 .status,
#ghostplus-gate [data-r],
#ghostplus-gate [data-msg],
#ghostplus-busy-detail{overflow-wrap:anywhere;white-space:normal}
#ghostplus-watch [data-budget-state]{min-width:0;flex:1}
@media(max-width:520px){
  #gitl9{width:min(300px,calc(100vw - 12px))!important}
  #gitl9 .tabs{flex-wrap:wrap}
  #gitl9 button{min-width:64px}
  #ghostplus-gate .r{flex-wrap:wrap}
}
`;
(document.head||document.documentElement).appendChild(style);
RT.node(style);
})();
