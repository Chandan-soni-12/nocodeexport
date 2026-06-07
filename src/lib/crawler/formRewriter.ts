// ============================================================
// formRewriter.ts — Make forms work after export
// Rewrites form actions to Formspree placeholders
// ============================================================

import * as cheerio from 'cheerio';

/**
 * Rewrite forms to work with Formspree after export
 */
export function rewriteForms(html: string): string {
  const $ = cheerio.load(html);

  $('form').each((index, el) => {
    const $form = $(el);
    
    // Get original action for reference
    const originalAction = $form.attr('action') || '';
    
    // Set Formspree placeholder
    $form.attr('action', 'https://formspree.io/f/PLACEHOLDER');
    $form.attr('method', 'POST');

    // Add comment before the form
    const comment = `\n<!-- Form ${index + 1}: Replace PLACEHOLDER with your Formspree ID -->\n<!-- Original action: ${originalAction} -->\n`;
    $form.before(comment);

    // Add hidden subject field if not present
    if ($form.find('input[name="_subject"]').length === 0) {
      $form.prepend(
        '<input type="hidden" name="_subject" value="New form submission" />\n'
      );
    }

    // Add anti-spam honeypot if not present
    if ($form.find('input[name="_gotcha"]').length === 0) {
      $form.prepend(
        '<input type="text" name="_gotcha" style="display:none" tabindex="-1" autocomplete="off" />\n'
      );
    }
  });

  return $.html();
}
