(() => {
'use strict';
if (window.__GHOST_PLUS_LAYOUT_FIX__) return;
window.__GHOST_PLUS_LAYOUT_FIX__ = true;

const style=document.createElement('style');
style.id='ghost-plus-layout-fix-style';
style.textContent=`
#gitl9 .head{padding-right:30px!important;}
#gitl9 .head .meta{margin-right:2px!important;max-width:150px!important;white-space:nowrap!important;overflow:hidden!important;text-overflow:ellipsis!important;}
`;
document.documentElement.appendChild(style);
})();