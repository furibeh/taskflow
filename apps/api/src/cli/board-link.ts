/** El código va en el fragmento (#k=) para que nunca llegue al servidor ni a los logs (R7). */
export const boardLink = (publicWebUrl: string, accessCode: string): string =>
  `${publicWebUrl.replace(/\/+$/, '')}/#k=${accessCode}`;
