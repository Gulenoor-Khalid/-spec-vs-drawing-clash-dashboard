# Design Updates: Grok LLM + English-Only

## Changes Made

### 1. LLM Provider: Grok (xAI)
- **Replaced**: Claude (Anthropic) and GPT-4 (OpenAI)
- **Reason**: Grok provides cost-effective, fast inference for document analysis
- **Configuration**: 
  - Environment variable: `LLM_PROVIDER=grok`
  - API Key: `LLM_API_KEY=<grok-api-key>`
  - Model: `LLM_MODEL=grok-2`

### 2. Language Support: English Only
- **Removed**: Multi-language detection and extraction (French, German, etc.)
- **Simplified**: 
  - No language detection module needed
  - No language-specific parameter keywords
  - Reduced complexity in extraction prompts
  - Faster processing (no language detection overhead)

### 3. Simplified Architecture
- **PDF Extraction**: Removed `detectLanguage()` method
- **Document Metadata**: Removed `language` field
- **Extraction Context**: Removed `language` parameter
- **Parameter Metadata**: Removed `language` field

### 4. Reduced Complexity
- **Extraction Prompts**: Simplified (no language parameter)
- **Error Handling**: Removed unsupported language errors
- **Testing**: Reduced test cases (no multi-language scenarios)
- **Documentation**: Simplified configuration and setup

## Benefits

1. **Faster Implementation**: ~20% reduction in development time
2. **Lower Costs**: Grok API is cost-effective; no language detection overhead
3. **Simpler Codebase**: Fewer conditional branches, easier maintenance
4. **Faster Processing**: No language detection step
5. **Easier Testing**: Single language focus

## Implementation Impact

### Phase 1: Foundation & Infrastructure
- LLM client now only supports Grok
- No language detection module needed
- Estimated effort: **6 hours** (down from 8 hours)

### Phase 2: PDF Processing & Extraction
- Extraction prompts simplified (no language parameter)
- No language detection logic
- Estimated effort: **30 hours** (down from 34 hours)

### Phase 5: Testing & Validation
- Fewer test cases (no multi-language scenarios)
- Estimated effort: **28 hours** (down from 30 hours)

### Total Effort Reduction
- **Original**: ~180 hours
- **Updated**: ~170 hours
- **Savings**: ~10 hours (~5.5% reduction)

## Configuration

### Environment Variables (Updated)

```bash
# LLM Configuration
LLM_PROVIDER=grok
LLM_API_KEY=<your-grok-api-key>
LLM_MODEL=grok-2

# Cache Configuration
CACHE_TYPE=redis|sqlite|file
CACHE_TTL=86400

# PDF Processing
CHUNK_SIZE=2500
CHUNK_OVERLAP=300
MAX_FILE_SIZE=52428800

# Feature Flags
ENABLE_HYBRID_EXTRACTION=true
```

## Grok API Integration

### Setup Steps

1. **Get Grok API Key**
   - Visit: https://console.x.ai/
   - Create API key
   - Store in environment variable: `LLM_API_KEY`

2. **Install Grok SDK**
   ```bash
   npm install @xai-org/sdk
   ```

3. **Initialize Grok Client**
   ```javascript
   const Grok = require('@xai-org/sdk');
   const grok = new Grok({
     apiKey: process.env.LLM_API_KEY,
     model: 'grok-2'
   });
   ```

### Extraction Prompt (Simplified)

```
You are a structural engineering document analyzer. Extract all structural parameters from the provided text.

Document Type: [specification|drawing]

For each parameter found, provide:
1. Parameter key (e.g., bearing_pressure_sls, strip_footing_width)
2. Value and unit
3. Confidence (0-1)
4. Context (surrounding text)

Known parameter types:
- Bearing pressures (SLS/ULS)
- Foundation dimensions (embedment, anchorage)
- Footing types and sizes (strip, isolated, tie beams)
- Loads (permanent, live)
- Material grades (concrete, rebar)
- Dimensions (parapet, slab, floor buildup)
- Levels (FFL, NGF)
- Concrete cover

Return JSON array of extracted parameters.
```

## Testing Considerations

### Removed Test Cases
- Multi-language document extraction
- Language detection accuracy
- Mixed-language document handling
- Language-specific parameter keywords

### Retained Test Cases
- English specification extraction
- English drawing extraction
- Parameter normalization
- Clash detection
- Cache functionality
- API integration

## Migration Notes

If you later need to support other languages:
1. Add language detection module back
2. Create language-specific extraction prompts
3. Update parameter metadata to include language
4. Add language-specific test cases
5. Consider using Claude or GPT-4 for better multi-language support

## Next Steps

1. ✅ Design updated with Grok + English-only
2. ⏭️ Proceed to implementation (Phase 1: Foundation & Infrastructure)
3. ⏭️ Set up Grok API credentials
4. ⏭️ Begin coding LLM client and cache layer

