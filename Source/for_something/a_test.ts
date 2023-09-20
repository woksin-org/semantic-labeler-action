import { describeThis} from '@woksin/typescript.testing';

describeThis('a test', () => {
    it('should be true', () => true.should.be.true);
});
