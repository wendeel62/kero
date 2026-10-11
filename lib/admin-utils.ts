// Puros do admin (sem "use server" — rotas e actions importam daqui).
export const sanitizeLikeTerm = (term: string) => term.replace(/[,()%_\\]/g, "").trim();
