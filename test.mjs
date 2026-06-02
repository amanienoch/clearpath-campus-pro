import { createServerFn } from '@tanstack/react-start';
console.log("SERVER FN:", createServerFn);
console.log("RETURN:", createServerFn({ method: 'POST', handler: () => {} }));
