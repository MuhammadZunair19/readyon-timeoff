import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditService } from '../../src/audit/audit.service';
import { AuditLogEntity } from '../../src/audit/entities/audit-log.entity';

describe('AuditService', () => {
    let service: AuditService;
    let repo: jest.Mocked<Repository<AuditLogEntity>>;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                AuditService,
                {
                    provide: getRepositoryToken(AuditLogEntity),
                    useValue: {
                        create: jest.fn(),
                        save: jest.fn(),
                        find: jest.fn(),
                    },
                },
            ],
        }).compile();

        service = module.get(AuditService);
        repo = module.get(getRepositoryToken(AuditLogEntity));
    });

    describe('log', () => {
        it('should save audit log with all provided fields', async () => {
            const input = {
                entityType: 'REQUEST',
                entityId: 'R1',
                action: 'CREATE',
                actorId: 'U1',
                beforeState: { a: 1 },
                afterState: { a: 2 },
            };

            const created = { ...input };

            repo.create.mockReturnValue(created as any);
            repo.save.mockResolvedValue(created as any);

            const result = await service.log(input);

            expect(repo.create).toHaveBeenCalled();
            expect(repo.save).toHaveBeenCalledWith(created);
            expect(result).toEqual(created);
        });

        it('should convert undefined values to null (COVERS BRANCHES 27,29)', async () => {
            const input = {
                entityType: 'REQUEST',
                entityId: 'R1',
                action: 'CREATE',
                actorId: undefined,
                beforeState: undefined,
                afterState: undefined,
            };

            const expected = {
                entityType: 'REQUEST',
                entityId: 'R1',
                action: 'CREATE',
                actorId: null,
                beforeState: null,
                afterState: null,
            };

            repo.create.mockReturnValue(expected as any);
            repo.save.mockResolvedValue(expected as any);

            const result = await service.log(input as any);

            expect(repo.create).toHaveBeenCalledWith(expected);
            expect(result).toEqual(expected);
        });
    });

    describe('getAuditsByEntity', () => {
        it('should return ordered audit logs', async () => {
            const mockData = [{ id: 1 }, { id: 2 }] as any;

            repo.find.mockResolvedValue(mockData);

            const result = await service.getAuditsByEntity('REQUEST', 'R1');

            expect(repo.find).toHaveBeenCalledWith({
                where: { entityType: 'REQUEST', entityId: 'R1' },
                order: { timestamp: 'DESC' },
            });

            expect(result).toEqual(mockData);
        });
    });
});