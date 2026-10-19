export function initialize(ctx) {
const { document, window, location, localStorage, sessionStorage, setTimeout, setInterval, clearTimeout, clearInterval, alert, confirm, store } = ctx;

function $(id){return document.getElementById(id);}
function toast(t){var el=$('toast');el.textContent=t;el.hidden=false;setTimeout(function(){el.hidden=true},2200);}
$('bot-fab').addEventListener('click',function(){var h=$('bot').hidden;$('bot').hidden=!h;this.setAttribute('aria-expanded',String(h));});
$('bot-x').addEventListener('click',function(){$('bot').hidden=true;});
document.addEventListener('click',function(e){var c=e.target.closest('[data-close]');if(c)$(c.dataset.close).close();});


return {

};
}
