import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { HcmAdapter } from './hcm.adapter';
import { HcmMockAdapter } from './hcm-mock.adapter';

@Module({
  imports: [HttpModule],
  providers: [
    {
      provide: 'HCM_ADAPTER',
      useClass: process.env['NODE_ENV'] === 'test' ? HcmMockAdapter : HcmAdapter,
    },
  ],
  exports: ['HCM_ADAPTER'],
})
export class HcmModule {}
