#ifdef EMSCRIPTEN
#include <emscripten/bind.h>
using namespace emscripten;
#endif

#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>

extern "C" {
#include "../linelog.h"
}

class memlinelog {
public:
	typedef linelog_lineinfo li;
	typedef linelog_linenum ln;
	typedef linelog_result res;
	typedef linelog_revnum rev;

	memlinelog() {
		std::memset(&ar, 0, sizeof(ar));
		std::memset(&buf, 0, sizeof(buf));
		clear();
		annotate(0);
	}

	res clear() {
		linelog_annotateresult_clear(&ar);
		return eval([&] { return linelog_clear(&buf); });
	}

	size_t getactualsize() {
		return linelog_getactualsize(&buf);
	}

	rev getmaxrev() {
		return linelog_getmaxrev(&buf);
	}

	res annotate(rev r) {
		return eval([&] { return linelog_annotate(&buf, &ar, r); });
	}

	res replacelines(rev brev, ln a1, ln a2, ln b1, ln b2) {
		return eval([&] { return linelog_replacelines(&buf, &ar, brev,
					a1, a2, b1, b2); });
	}

	std::vector<li> getannotateresult() {
		std::vector<li> v(ar.lines, ar.lines + ar.linecount);
		return v;
	}

	std::vector<li> getalllines() {
		linelog_annotateresult al = { 0, 0, 0 };
		res r = linelog_getalllines(&buf, &al, 0, 0);
		if (r == LINELOG_RESULT_OK) {
			std::vector<li> v(al.lines, al.lines + al.linecount);
			return v;
		} else {
			return std::vector<li>();
		}
	}

#ifdef EMSCRIPTEN
	emscripten::val getrawbytes() {
		return emscripten::val(emscripten::typed_memory_view(
					getactualsize(), buf.data));
	}

	res setrawbytes(const std::string& bytes /* Uint8Array */) {
		res r = resize(bytes.size());
		if (r == LINELOG_RESULT_OK)
			std::memcpy(buf.data, bytes.data(), bytes.size());
		return r;
	}
#endif

private:
	/* handle LINELOG_RESULT_ENEEDRESIZE automatically */
	template<typename T>
	res eval(const T& func) {
		while (1) {
			res r = func();
			if (r == LINELOG_RESULT_ENEEDRESIZE) {
				size_t newsize = (buf.neededsize | 0xfff) + 1;
				r = this->resize(newsize);
				if (r == LINELOG_RESULT_OK)
					continue; /* retry */
			}
			return r;
		}
	}

	res resize(size_t newsize) {
		uint8_t *p = (uint8_t *) std::realloc(buf.data, newsize);
		if (p == NULL)
			return LINELOG_RESULT_ENOMEM;
		buf.data = p;
		buf.size = newsize;
		return LINELOG_RESULT_OK;
	}

	linelog_annotateresult ar;
	linelog_buf buf;
};

#ifdef EMSCRIPTEN
EMSCRIPTEN_BINDINGS(memlinelog) {
	emscripten::value_array<memlinelog::li>("LineInfo")
		.element(&linelog_lineinfo::rev)
		.element(&linelog_lineinfo::linenum)
		.element(&linelog_lineinfo::offset)
		;
	emscripten::register_vector<memlinelog::li>("VectorLineInfo");
	emscripten::class_<memlinelog>("MemLinelog")
		.constructor()
		.function("clear", &memlinelog::clear)
		.function("getActualSize", &memlinelog::getactualsize)
		.function("getMaxRev", &memlinelog::getmaxrev)
		.function("annotate", &memlinelog::annotate)
		.function("replaceLines", &memlinelog::replacelines)
		.function("getAnnotateResult", &memlinelog::getannotateresult)
		.function("getAllLines", &memlinelog::getalllines)
		.function("getRawBytes", &memlinelog::getrawbytes)
		.function("setRawBytes", &memlinelog::setrawbytes)
		;
}
#endif
