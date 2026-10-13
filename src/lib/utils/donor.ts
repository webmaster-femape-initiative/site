const DONOR_NUMBER_PREFIX = 'FEM';
const DONOR_NUMBER_LENGTH = 8;

/**
 * Transforme le numéro interne d'un donateur
 * en référence publique.
 *
 * Exemple :
 * 1247 -> FEM-00001247
 */
export function formatDonorNumber(donorNumber: number): string {
	return `${DONOR_NUMBER_PREFIX}-${String(donorNumber).padStart(DONOR_NUMBER_LENGTH, '0')}`;
}
