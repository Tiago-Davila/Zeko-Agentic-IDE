interface TemplateUpdateDialogProps {
  readonly onDecision: (decision: 'ACCEPT' | 'REJECT') => void;
}

export function TemplateUpdateDialog({ onDecision }: TemplateUpdateDialogProps) {
  return <section aria-label="Actualización de plantilla"><p>La actualización solo aplica a ejecuciones futuras.</p><button onClick={() => onDecision('ACCEPT')}>Aceptar actualización</button><button onClick={() => onDecision('REJECT')}>Mantener versión actual</button></section>;
}
