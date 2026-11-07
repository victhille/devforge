import type { Locator, Page } from '@playwright/test'

/** v4.3: the app's own confirm dialog, which replaced Windows' `window.confirm` */
export const confirmDialog = (page: Page): Locator => page.getByRole('dialog', { name: /^(Es-tu sûr \?|Are you sure\?)$/ })

/** Its buttons */
export const confirmButton = (page: Page): Locator => confirmDialog(page).getByRole('button', { name: /^(Confirmer|Confirm)$/ })
export const cancelButton = (page: Page): Locator => confirmDialog(page).getByRole('button', { name: /^(Annuler|Cancel)$/ })

/** Every question of the test answered « yes », as `page.on('dialog', d => d.accept())` did */
export async function acceptConfirms(page: Page): Promise<void> {
  await page.addLocatorHandler(confirmDialog(page), async () => { await confirmButton(page).click() })
}
