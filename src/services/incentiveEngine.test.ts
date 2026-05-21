
import { startIncentiveEngine } from './incentiveEngine';
import { Kafka } from 'kafkajs';
import Redis from 'ioredis';

jest.mock('kafkajs');
jest.mock('ioredis');

describe('incentiveEngine', () => {
    let mockKafka: any;
    let mockRedis: any;
    let mockConsumer: any;

    beforeEach(() => {
        mockConsumer = {
            connect: jest.fn(),
            subscribe: jest.fn(),
            run: jest.fn(),
            disconnect: jest.fn(),
        };
        mockKafka = {
            consumer: jest.fn(() => mockConsumer),
        };
        mockRedis = {
            script: jest.fn().mockResolvedValue('mock-sha'),
            evalsha: jest.fn(),
        };
    });

    it('should start the incentive engine consumer', async () => {
        await startIncentiveEngine(mockKafka, mockRedis);
        expect(mockKafka.consumer).toHaveBeenCalledWith({ groupId: 'incentive-group' });
        expect(mockConsumer.connect).toHaveBeenCalled();
        expect(mockConsumer.subscribe).toHaveBeenCalledWith({ topic: 'rider-location-updates', fromBeginning: false });
        expect(mockConsumer.run).toHaveBeenCalled();
    });

    it('should handle NOSCRIPT error and retry', async () => {
        // Mock evalsha to throw NOSCRIPT then succeed
        mockRedis.evalsha.mockRejectedValueOnce(new Error('NOSCRIPT'));
        mockRedis.evalsha.mockResolvedValueOnce(1);
        
        await startIncentiveEngine(mockKafka, mockRedis);
        
        // This is tricky as we need to trigger eachMessage
        const runArgs = mockConsumer.run.mock.calls[0][0];
        const { eachMessage } = runArgs;
        
        const mockMessage = {
            value: Buffer.from(JSON.stringify({ latitude: 1, longitude: 1, rider_id: '1' }))
        };
        
        await eachMessage({ message: mockMessage, topic: 'test', partition: 0 });
        
        expect(mockRedis.evalsha).toHaveBeenCalledTimes(2);
    });
});
