# Requirements: AI-Powered PDF Clash Detection Dashboard Upgrade

## Functional Requirements

### FR1: Multi-Format PDF Text Extraction

**Description**: The system shall extract text from any PDF document (architectural, structural, MEP drawings and specifications) while preserving spatial layout information.

**Acceptance Criteria**:
- Extract text from PDFs up to 100+ pages
- Preserve layout information for spatial context
- Classify document type (specification vs. drawing)
- Handle corrupted or malformed PDFs gracefully with error messages
- Support English language documents

**Priority**: Critical
**Complexity**: Medium

---

### FR2: Intelligent Document Chunking

**Description**: The system shall intelligently chunk large PDF text into overlapping segments for efficient LLM processing while maintaining semantic context.

**Acceptance Criteria**:
- Split documents into 2000-3000 token chunks
- Maintain 200-300 token overlap between chunks
- Preserve context across chunk boundaries
- Avoid splitting mid-sentence or mid-parameter
- Track chunk indices for traceability

**Priority**: Critical
**Complexity**: Medium

---

### FR3: LLM-Based Semantic Parameter Extraction

**Description**: The system shall use Grok LLM API to semantically extract structural parameters from any document format, replacing regex-based extraction.

**Acceptance Criteria**:
- Extract parameters from specification documents (bearing pressures, embedment, anchorage, loads, material grades, dimensions, levels)
- Extract parameters from drawing documents (footing dimensions, material callouts, dimension annotations)
- Support multiple document types (structural specs, architectural drawings, MEP plans)
- Support English language documents
- Assign confidence scores (0-1) to each extracted parameter
- Return structured JSON with parameter key, value, unit, context, and confidence

**Priority**: Critical
**Complexity**: High

---

### FR4: Parameter Normalization

**Description**: The system shall normalize extracted parameters to standard units and formats for consistent comparison.

**Acceptance Criteria**:
- Convert all dimensions to millimeters (mm)
- Convert all pressures to MPa
- Convert all loads to kg/m²
- Convert all levels to NGF (or project-specific datum)
- Validate normalized values are within reasonable ranges
- Preserve original unit information for reference

**Priority**: Critical
**Complexity**: Low

---

### FR5: Parameter Caching

**Description**: The system shall cache extracted parameters to avoid re-processing identical or similar documents.

**Acceptance Criteria**:
- Hash PDF content to detect identical documents
- Store extracted parameters with metadata
- Implement TTL (time-to-live) for cache entries (default: 24 hours)
- Support cache invalidation by pattern or full clear
- Track cache hit/miss rates
- Support multiple cache backends (Redis, SQLite, file-based)

**Priority**: High
**Complexity**: Medium

---

### FR6: Intelligent Parameter Matching

**Description**: The system shall match parameters across different document formats and types using semantic similarity and context.

**Acceptance Criteria**:
- Match parameters by key (exact match)
- Match parameters by semantic meaning (similar context, different format)
- Handle multi-instance parameters (multiple strip footings, loads, etc.)
- Compute similarity scores (0-1) for each match
- Classify match types: exact, semantic, partial, missing
- Support fuzzy matching for similar but not identical parameters

**Priority**: Critical
**Complexity**: High

---

### FR7: Context-Aware Clash Detection

**Description**: The system shall detect clashes between specification and drawing parameters using context-aware tolerance bands.

**Acceptance Criteria**:
- Compute tolerance bands based on parameter type and context
- Classify clashes: MATCH, MARGINAL, CLASH, MISSING_IN_DRAWING, MISSING_IN_SPEC
- Assign severity levels: critical, warning, info
- Generate actionable suggestions for engineers
- Support custom tolerance rules per project
- Handle dimension objects (footings with width/depth/height)

**Priority**: Critical
**Complexity**: High

---

### FR8: Backward Compatibility

**Description**: The system shall maintain backward compatibility with the existing API and regex-based extraction.

**Acceptance Criteria**:
- Existing /api/analyze endpoint continues to work
- Response format remains compatible with current dashboard
- Regex-based extraction available as fallback
- Hybrid extraction mode (regex + LLM) available during transition
- No breaking changes to API contracts

**Priority**: High
**Complexity**: Medium

---

### FR9: English Language Support

**Description**: The system shall support parameter extraction from English language documents.

**Acceptance Criteria**:
- Extract parameters from English specification documents
- Extract parameters from English drawing documents
- Handle technical terminology and abbreviations
- Support mixed-case text and various formatting

**Priority**: High
**Complexity**: Low

---

### FR10: Large Document Handling

**Description**: The system shall efficiently process large specification documents (100+ pages) without performance degradation.

**Acceptance Criteria**:
- Process 100-page specification in <60 seconds
- Process 10-page specification in <10 seconds
- Stream PDF text extraction to minimize memory usage
- Implement parallel chunk processing
- Support async LLM API calls

**Priority**: High
**Complexity**: High

---

### FR11: Error Handling and Recovery

**Description**: The system shall handle errors gracefully and provide meaningful error messages.

**Acceptance Criteria**:
- Handle corrupted PDFs with clear error messages
- Handle LLM API timeouts with retry logic
- Handle LLM API rate limits with queuing
- Handle unsupported languages with fallback
- Handle low-confidence extractions with warnings
- Provide detailed error logs for debugging

**Priority**: Medium
**Complexity**: Medium

---

### FR12: Analysis Result Persistence

**Description**: The system shall store analysis results for later retrieval and audit trails.

**Acceptance Criteria**:
- Store analysis results with unique ID
- Include file metadata (name, hash, language)
- Include extracted parameters and matches
- Include clash findings and suggestions
- Support result retrieval by ID
- Implement data retention policies

**Priority**: Medium
**Complexity**: Medium

---

## Non-Functional Requirements

### NFR1: Performance

**Description**: The system shall meet performance targets for document processing.

**Acceptance Criteria**:
- Small spec (10 pages): <10 seconds
- Large spec (100+ pages): <60 seconds
- Cache hit: <1 second
- API response time: <100ms (excluding LLM processing)

**Priority**: High

---

### NFR2: Scalability

**Description**: The system shall scale to handle concurrent requests and large documents.

**Acceptance Criteria**:
- Support 10+ concurrent analysis requests
- Handle documents up to 100+ pages
- Support 1000+ cached documents
- Implement connection pooling for LLM API
- Use async/await for non-blocking operations

**Priority**: High

---

### NFR3: Reliability

**Description**: The system shall be reliable and fault-tolerant.

**Acceptance Criteria**:
- 99% uptime for API endpoints
- Automatic retry for transient failures
- Graceful degradation when LLM API is unavailable
- Data consistency across cache and storage
- Comprehensive error logging

**Priority**: High

---

### NFR4: Security

**Description**: The system shall protect user data and API credentials.

**Acceptance Criteria**:
- Validate file uploads (type, size)
- Sanitize extracted parameters
- Encrypt sensitive data at rest
- Secure API key management
- Implement rate limiting
- Require authentication for production deployments

**Priority**: High

---

### NFR5: Maintainability

**Description**: The system shall be maintainable and extensible.

**Acceptance Criteria**:
- Clear separation of concerns (extraction, matching, detection)
- Comprehensive unit and integration tests
- Well-documented code and APIs
- Support for custom tolerance rules
- Support for custom parameter types
- Easy configuration via environment variables

**Priority**: Medium

---

### NFR6: Cost Efficiency

**Description**: The system shall minimize LLM API costs while maintaining quality.

**Acceptance Criteria**:
- Cache results to minimize API calls
- Use efficient prompts to minimize token usage
- Support batch processing for similar documents
- Implement selective extraction (only relevant parameters)
- Track API usage and costs

**Priority**: Medium

---

## Data Requirements

### DR1: Parameter Storage

**Description**: The system shall store extracted parameters with full metadata.

**Data Model**:
```
Parameter {
  id: UUID
  key: string (e.g., 'bearing_pressure_sls')
  label: string (e.g., 'Allowable bearing pressure (SLS)')
  value: number | string | object
  unit: string (e.g., 'MPa')
  confidence: number (0-1)
  source: 'specification' | 'drawing'
  context: string (surrounding text)
  extractedAt: timestamp
  chunkIndex: number
  metadata: {
    documentType: string
    language: string
    section: string
    pageReference: string
    extractionMethod: 'regex' | 'llm' | 'hybrid'
  }
}
```

**Priority**: Critical

---

### DR2: Analysis Result Storage

**Description**: The system shall store complete analysis results for audit and retrieval.

**Data Model**:
```
AnalysisResult {
  id: UUID
  createdAt: timestamp
  files: {
    drawing: { name, hash, textLength, language }
    specification: { name, hash, textLength, language }
  }
  extracted: {
    spec: Parameter[]
    drawing: Parameter[]
  }
  matches: MatchResult[]
  findings: ClashFinding[]
  summary: {
    total, matches, marginal, clashes, missingInDrawing, missingInSpec, compliancePct
  }
}
```

**Priority**: High

---

### DR3: Cache Storage

**Description**: The system shall store cached parameters for quick retrieval.

**Data Model**:
```
CacheEntry {
  documentHash: string
  parameters: Parameter[]
  storedAt: timestamp
  expiresAt: timestamp
  hitCount: number
}
```

**Priority**: High

---

## Integration Requirements

### IR1: LLM API Integration

**Description**: The system shall integrate with Grok LLM API for semantic extraction.

**Acceptance Criteria**:
- Support Grok API (xAI)
- Implement retry logic with exponential backoff
- Handle rate limiting gracefully
- Track API usage and costs
- Support custom prompts and models

**Priority**: Critical

---

### IR2: Cache Backend Integration

**Description**: The system shall support multiple cache backends.

**Acceptance Criteria**:
- Support Redis for distributed systems
- Support SQLite for single-server deployments
- Support file-based caching for development
- Implement consistent cache interface
- Support cache statistics and monitoring

**Priority**: High

---

### IR3: PDF Processing Integration

**Description**: The system shall integrate with PDF processing tools.

**Acceptance Criteria**:
- Use pdftotext (poppler) for text extraction
- Support layout preservation
- Handle multi-page documents
- Support UTF-8 encoding for multi-language documents

**Priority**: Critical

---

## Acceptance Criteria Summary

| Requirement | Acceptance Criteria | Status |
|-------------|-------------------|--------|
| FR1 | Extract text from 100+ page PDFs with layout preservation | Pending |
| FR2 | Chunk documents into 2000-3000 token segments with overlap | Pending |
| FR3 | Extract parameters from any document format using LLM | Pending |
| FR4 | Normalize all parameters to standard units | Pending |
| FR5 | Cache extracted parameters with TTL and invalidation | Pending |
| FR6 | Match parameters across formats with similarity scores | Pending |
| FR7 | Detect clashes with context-aware tolerance bands | Pending |
| FR8 | Maintain backward compatibility with existing API | Pending |
| FR9 | Support English language parameter extraction | Pending |
| FR10 | Process 100-page specs in <60 seconds | Pending |
| FR11 | Handle errors gracefully with meaningful messages | Pending |
| FR12 | Store analysis results for audit trails | Pending |
| NFR1 | Meet performance targets (10s for small, 60s for large) | Pending |
| NFR2 | Scale to 10+ concurrent requests and 1000+ cached docs | Pending |
| NFR3 | Achieve 99% uptime with automatic retry | Pending |
| NFR4 | Protect user data and API credentials | Pending |
| NFR5 | Maintain clear code structure and documentation | Pending |
| NFR6 | Minimize LLM API costs through caching | Pending |

