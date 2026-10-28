import {
  IPatientRepository,
  PatientSearchItem,
} from '../domain/patient.repository.interface';

export interface SearchPatientsOutput {
  message?: string;
  data: PatientSearchItem[];
}

export class SearchPatientsUseCase {
  constructor(private readonly patientRepository: IPatientRepository) {}

  public async execute(query?: string): Promise<SearchPatientsOutput> {
    const normalizedQuery = query?.trim() ? query.trim() : undefined;
    const results = await this.patientRepository.searchPatients(normalizedQuery);

    if (results.length === 0) {
      return {
        message: 'ninguna coincidencia encontrada',
        data: [],
      };
    }

    return {
      data: results,
    };
  }
}