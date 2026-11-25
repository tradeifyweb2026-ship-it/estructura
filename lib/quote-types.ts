export const QUOTE_CATEGORIES={disciplina:'Disciplina',paciencia:'Paciencia',riesgo:'Gestión de riesgo',mentalidad:'Mentalidad',psicologia:'Psicología del trading',emociones:'Control emocional',consistencia:'Consistencia',motivacion:'Motivación',aprendizaje:'Aprendizaje',superacion:'Superación',enfoque:'Enfoque',responsabilidad:'Responsabilidad',perdidas:'Gestión de pérdidas'} as const;
export type QuoteCategory=keyof typeof QUOTE_CATEGORIES;
export type Quote={id:number;text:string;credit:string|null;category:QuoteCategory;provenance:'original'|'unverified'};
