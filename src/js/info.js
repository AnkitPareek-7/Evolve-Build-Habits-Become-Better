/* About / info popup (opened by the icon button next to the GitHub link) */
import { $ } from './config.js';

const dialog = $('infoDialog');

$('infoBtn').addEventListener('click', () => dialog.showModal());
$('infoClose').addEventListener('click', () => dialog.close());
/* Clicking the dimmed area outside the dialog closes it */
dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });