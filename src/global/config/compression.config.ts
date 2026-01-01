import compression from 'compression';

/**
 * 응답 압축 설정 옵션
 */
export const compressionOptions: compression.CompressionOptions = {
  threshold: 1024,
  level: 6,
  // 압축 필터: 이미 인코딩된 응답은 압축하지 않음
  filter: (req, res) => {
    if (res.getHeader('content-encoding')) return false;
    return compression.filter(req, res);
  },
};
